"""
apple_notifications.py — Apple App Store Server Notifications v2 webhook

POST /apple/notifications
────────────────────────────────────────────────────────────────────────────
Receives signed JWS payloads from Apple App Store Server.
Apple calls this endpoint automatically for:
  • SUBSCRIBED         — new subscription
  • DID_RENEW          — successful auto-renewal
  • DID_FAIL_TO_RENEW  — billing failure
  • EXPIRED            — subscription expired
  • GRACE_PERIOD_EXPIRED
  • REVOKE / REFUND
  • etc.

Configuration:
  App Store Connect → Your App → Subscriptions →
    App Store Server Notifications → Production URL + Sandbox URL
    Set to: https://api.yourdomain.com/apple/notifications

Security:
  • Payload is a JWS (JSON Web Signature) — verify in production
  • Return HTTP 200 immediately; process async to avoid Apple retry storm
  • All notifications logged to apple_notifications table for audit
  • Idempotent: keyed on notificationUUID
"""

from __future__ import annotations
import logging
from datetime import timezone

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import AsyncSessionLocal
from services.apple_iap import parse_notification

logger = logging.getLogger(__name__)
router = APIRouter()


class NotificationBody(BaseModel):
    signedPayload: str


# ── POST /apple/notifications ─────────────────────────────────────────────────

@router.post("/notifications", status_code=200)
async def receive_notification(
    body:       NotificationBody,
    background: BackgroundTasks,
):
    """
    Apple sends a POST with { "signedPayload": "<JWS>" }.

    We acknowledge immediately with 200 (Apple requires < 5s response),
    then process the notification in the background.

    If we return non-200, Apple will retry up to 5 times with backoff.
    """
    background.add_task(_process_notification, body.signedPayload)
    return {"received": True}


async def _process_notification(signed_payload: str) -> None:
    """
    Background task: parse JWS → update subscription in DB.
    Creates its own DB session (background tasks can't reuse request session).
    """
    async with AsyncSessionLocal() as db:
        try:
            await _handle(db, signed_payload)
        except Exception as exc:
            logger.error("Apple notification processing error: %s", exc, exc_info=True)


async def _handle(db: AsyncSession, signed_payload: str) -> None:
    from sqlalchemy import text

    # ── 1. Parse & verify JWS ────────────────────────────────────────────────
    try:
        notif = parse_notification(signed_payload)
    except Exception as exc:
        # Log malformed payload and abort
        await db.execute(
            text("""
                INSERT INTO apple_notifications
                    (notification_type, subtype, payload_raw, processed, error_message)
                VALUES ('PARSE_ERROR', NULL, :raw, false, :err)
            """),
            {"raw": signed_payload[:10_000], "err": str(exc)},
        )
        await db.commit()
        logger.warning("Failed to parse Apple notification: %s", exc)
        return

    notification_type  = notif["notification_type"]
    subtype            = notif.get("subtype")
    notification_uuid  = notif.get("notification_uuid", "")
    orig_tx_id         = notif.get("original_transaction_id", "")
    product_id         = notif.get("product_id", "")
    environment        = notif.get("environment", "sandbox")
    subscription_status = notif.get("subscription_status", "unknown")

    # ── 2. Idempotency check (deduplicate by notificationUUID) ────────────────
    if notification_uuid:
        dup = await db.execute(
            text("SELECT id FROM apple_notifications WHERE notification_uuid = :uuid"),
            {"uuid": notification_uuid},
        )
        if dup.fetchone():
            logger.info("Duplicate Apple notification %s — skipped", notification_uuid)
            return

    # ── 3. Log notification ───────────────────────────────────────────────────
    await db.execute(
        text("""
            INSERT INTO apple_notifications (
                notification_uuid, notification_type, subtype,
                original_transaction_id, product_id, environment,
                payload_raw, processed
            ) VALUES (
                :uuid, :type, :subtype, :orig_tx, :pid, :env,
                :raw, false
            )
        """),
        {
            "uuid":    notification_uuid or None,
            "type":    notification_type,
            "subtype": subtype,
            "orig_tx": orig_tx_id,
            "pid":     product_id,
            "env":     environment,
            "raw":     signed_payload[:10_000],
        },
    )

    # ── 4. Find user by original_transaction_id ───────────────────────────────
    if not orig_tx_id:
        logger.warning("Notification missing originalTransactionId — cannot update subscription")
        await db.commit()
        return

    sub_row = await db.execute(
        text("SELECT user_id FROM subscriptions WHERE original_transaction_id = :id"),
        {"id": orig_tx_id},
    )
    sub = sub_row.fetchone()

    if sub:
        user_id = str(sub.user_id)
    else:
        # New subscription not yet in our DB — can't assign to user without receipt verify
        # Store the notification; mobile app should call /subscriptions/verify-receipt
        logger.info("Unknown orig_tx_id %s — notification logged, awaiting verify-receipt", orig_tx_id)
        await db.execute(
            text("UPDATE apple_notifications SET processed = true WHERE notification_uuid = :uuid"),
            {"uuid": notification_uuid},
        )
        await db.commit()
        return

    # ── 5. Update subscription status ────────────────────────────────────────
    import uuid as _uuid

    update_fields: dict = {
        "status":       subscription_status,
        "product_id":   product_id or None,
        "auto_renew":   notif.get("auto_renew_status", True),
        "auto_renew_pid": notif.get("auto_renew_product_id"),
        "expires_date": notif.get("expires_date"),
        "grace_exp":    notif.get("grace_period_expires_date"),
        "revoke_date":  notif.get("revocation_date"),
        "revoke_reason":notif.get("revocation_reason"),
        "orig_tx_id":   orig_tx_id,
        "user_id":      user_id,
        "new_id":       str(_uuid.uuid4()),
        "bundle_id":    notif.get("bundle_id", "com.chailyn.app"),
        "purchase_date":notif.get("purchase_date"),
        "environment":  environment,
        "offer_type":   notif.get("offer_type"),
        "offer_id":     notif.get("offer_identifier"),
    }

    await db.execute(
        text("""
            INSERT INTO subscriptions (
                id, user_id, original_transaction_id, product_id, bundle_id,
                status, environment, purchase_date, expires_date,
                grace_period_expires_date, auto_renew_status, auto_renew_product_id,
                revocation_date, revocation_reason, offer_type, offer_identifier,
                updated_at
            ) VALUES (
                :new_id, :user_id, :orig_tx_id, :product_id, :bundle_id,
                :status, :environment, :purchase_date, :expires_date,
                :grace_exp, :auto_renew, :auto_renew_pid,
                :revoke_date, :revoke_reason, :offer_type, :offer_id,
                now()
            )
            ON CONFLICT (original_transaction_id) DO UPDATE SET
                status                    = EXCLUDED.status,
                expires_date              = EXCLUDED.expires_date,
                grace_period_expires_date = EXCLUDED.grace_period_expires_date,
                auto_renew_status         = EXCLUDED.auto_renew_status,
                auto_renew_product_id     = EXCLUDED.auto_renew_product_id,
                revocation_date           = EXCLUDED.revocation_date,
                revocation_reason         = EXCLUDED.revocation_reason,
                updated_at                = now()
        """),
        update_fields,
    )

    # ── 6. Sync user subscription_tier ───────────────────────────────────────
    if subscription_status == "active":
        await db.execute(
            text("UPDATE users SET subscription_tier = 'pro' WHERE id = :id"),
            {"id": user_id},
        )
        logger.info("User %s → subscription active (%s)", user_id, product_id)

    elif subscription_status in ("expired", "revoked"):
        # Only downgrade if truly no active subscription left
        active_check = await db.execute(
            text("""
                SELECT id FROM subscriptions
                WHERE user_id = :uid AND status = 'active'
                  AND original_transaction_id != :orig_tx
                LIMIT 1
            """),
            {"uid": user_id, "orig_tx": orig_tx_id},
        )
        if not active_check.fetchone():
            await db.execute(
                text("UPDATE users SET subscription_tier = 'free' WHERE id = :id"),
                {"id": user_id},
            )
            logger.info("User %s → subscription %s → tier downgraded to free",
                        user_id, subscription_status)

    elif subscription_status == "grace_period":
        # Keep pro access during grace period (Apple standard)
        logger.info("User %s → billing grace period — keeping pro access", user_id)

    elif subscription_status == "billing_retry":
        logger.info("User %s → billing retry — keeping access temporarily", user_id)

    # ── 7. Mark notification as processed ────────────────────────────────────
    if notification_uuid:
        await db.execute(
            text("UPDATE apple_notifications SET processed = true WHERE notification_uuid = :uuid"),
            {"uuid": notification_uuid},
        )

    await db.commit()
    logger.info("Processed %s/%s for txn %s → status=%s",
                notification_type, subtype, orig_tx_id, subscription_status)
