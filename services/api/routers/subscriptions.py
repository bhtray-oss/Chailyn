"""
subscriptions.py — Apple IAP verification + subscription status

POST /subscriptions/verify-receipt
    iOS sends the original_transaction_id after StoreKit 2 purchase.
    We verify with Apple App Store Server API and upsert subscription.

GET  /subscriptions/status
    Returns current subscription status for authenticated user.

POST /subscriptions/restore
    Restore purchases (re-verify all active original_transaction_ids).
"""

from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from db.database import get_db
from routers.auth import get_current_user
from services.apple_iap import get_subscription_statuses, derive_status

router = APIRouter()


class VerifyReceiptIn(BaseModel):
    original_transaction_id: str
    product_id:              str
    environment:             str = "production"   # sandbox | production


class RestoreIn(BaseModel):
    original_transaction_ids: list[str]


# ── Helper: upsert subscription row ──────────────────────────────────────────

async def _upsert_subscription(db: AsyncSession, user_id: str, data: dict) -> None:
    """
    Insert or update a subscription record.
    Uses original_transaction_id as the unique key.
    """
    await db.execute(
        text("""
            INSERT INTO subscriptions (
                id, user_id, original_transaction_id, product_id, bundle_id,
                status, environment, purchase_date, expires_date,
                grace_period_expires_date, auto_renew_status, auto_renew_product_id,
                revocation_date, revocation_reason, offer_type, offer_identifier,
                updated_at
            ) VALUES (
                :id, :user_id, :orig_tx_id, :product_id, :bundle_id,
                :status, :env, :purchase_date, :expires_date,
                :grace_exp, :auto_renew, :auto_renew_pid,
                :revoke_date, :revoke_reason, :offer_type, :offer_id,
                now()
            )
            ON CONFLICT (original_transaction_id) DO UPDATE SET
                user_id                   = EXCLUDED.user_id,
                status                    = EXCLUDED.status,
                expires_date              = EXCLUDED.expires_date,
                grace_period_expires_date = EXCLUDED.grace_period_expires_date,
                auto_renew_status         = EXCLUDED.auto_renew_status,
                auto_renew_product_id     = EXCLUDED.auto_renew_product_id,
                revocation_date           = EXCLUDED.revocation_date,
                revocation_reason         = EXCLUDED.revocation_reason,
                updated_at                = now()
        """),
        {
            "id":             str(uuid.uuid4()),
            "user_id":        user_id,
            "orig_tx_id":     data["original_transaction_id"],
            "product_id":     data.get("product_id", ""),
            "bundle_id":      data.get("bundle_id", "com.chailyn.app"),
            "status":         data.get("subscription_status", "active"),
            "env":            data.get("environment", "production"),
            "purchase_date":  data.get("purchase_date"),
            "expires_date":   data.get("expires_date"),
            "grace_exp":      data.get("grace_period_expires_date"),
            "auto_renew":     data.get("auto_renew_status", True),
            "auto_renew_pid": data.get("auto_renew_product_id"),
            "revoke_date":    data.get("revocation_date"),
            "revoke_reason":  data.get("revocation_reason"),
            "offer_type":     data.get("offer_type"),
            "offer_id":       data.get("offer_identifier"),
        },
    )

    # Update user subscription_tier if active
    if data.get("subscription_status") == "active":
        await db.execute(
            text("UPDATE users SET subscription_tier = 'pro' WHERE id = :id"),
            {"id": user_id},
        )
    elif data.get("subscription_status") in ("expired", "revoked"):
        # Downgrade only if no other active subscription exists
        active = await db.execute(
            text("SELECT id FROM subscriptions WHERE user_id = :uid AND status = 'active' LIMIT 1"),
            {"uid": user_id},
        )
        if not active.fetchone():
            await db.execute(
                text("UPDATE users SET subscription_tier = 'free' WHERE id = :id"),
                {"id": user_id},
            )


# ── POST /subscriptions/verify-receipt ───────────────────────────────────────

@router.post("/verify-receipt")
async def verify_receipt(
    body:         VerifyReceiptIn,
    current_user: dict = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """
    Verify a StoreKit 2 transaction with the App Store Server API.
    Called by iOS immediately after a successful purchase.

    Flow:
      iOS: purchase → StoreKit 2 returns originalTransactionId
      iOS → POST /subscriptions/verify-receipt  { original_transaction_id, product_id }
      Backend → App Store Server API: GET /inApps/v1/subscriptions/{id}
      Backend: upsert subscription record, upgrade user tier
    """
    user_id = current_user["id"]

    # Fetch latest status from Apple
    statuses = await get_subscription_statuses(body.original_transaction_id)

    if not statuses:
        # Apple API unavailable or key not configured — store provisional record
        await _upsert_subscription(db, user_id, {
            "original_transaction_id": body.original_transaction_id,
            "product_id":              body.product_id,
            "subscription_status":     "active",
            "environment":             body.environment,
            "purchase_date":           datetime.now(timezone.utc),
        })
        await db.commit()
        return {"status": "active", "message": "Stored provisionally — Apple API pending"}

    # Process each subscription group returned by Apple
    for group in statuses:
        for item in group.get("lastTransactions", []):
            # Decode the signedTransactionInfo
            from services.apple_iap import verify_jws_payload, ms_to_dt
            try:
                tx = verify_jws_payload(item["signedTransactionInfo"])
            except Exception:
                continue

            orig_tx_id = tx.get("originalTransactionId", body.original_transaction_id)
            status_num = item.get("status", 1)
            # Apple status: 1=active, 2=expired, 3=billing_retry, 4=grace_period, 5=revoked
            status_map = {1: "active", 2: "expired", 3: "billing_retry",
                          4: "grace_period", 5: "revoked"}
            sub_status = status_map.get(status_num, "unknown")

            await _upsert_subscription(db, user_id, {
                "original_transaction_id": orig_tx_id,
                "product_id":              tx.get("productId", body.product_id),
                "subscription_status":     sub_status,
                "environment":             item.get("environment", body.environment).lower(),
                "purchase_date":           datetime.fromtimestamp(
                    tx.get("purchaseDate", 0) / 1000, tz=timezone.utc
                ) if tx.get("purchaseDate") else None,
                "expires_date":            datetime.fromtimestamp(
                    tx.get("expiresDate", 0) / 1000, tz=timezone.utc
                ) if tx.get("expiresDate") else None,
                "auto_renew_status": True,
            })

    await db.commit()

    # Return current status for the queried transaction
    row = await db.execute(
        text("SELECT status, expires_date, product_id FROM subscriptions "
             "WHERE original_transaction_id = :id"),
        {"id": body.original_transaction_id},
    )
    rec = row.fetchone()
    return {
        "status":       rec.status if rec else "active",
        "expires_date": rec.expires_date.isoformat() if rec and rec.expires_date else None,
        "product_id":   rec.product_id if rec else body.product_id,
    }


# ── GET /subscriptions/status ─────────────────────────────────────────────────

@router.get("/status")
async def get_status(
    current_user: dict = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Return latest subscription status for the authenticated user."""
    row = await db.execute(
        text("""
            SELECT status, product_id, expires_date, auto_renew_status, environment
            FROM subscriptions
            WHERE user_id = :uid
            ORDER BY
                CASE status WHEN 'active' THEN 0 WHEN 'grace_period' THEN 1 ELSE 2 END,
                expires_date DESC NULLS LAST
            LIMIT 1
        """),
        {"uid": current_user["id"]},
    )
    sub = row.fetchone()

    if not sub:
        return {
            "subscribed":    False,
            "tier":          current_user.get("subscription_tier", "free"),
            "status":        None,
            "product_id":    None,
            "expires_date":  None,
            "auto_renew":    None,
        }

    is_active = sub.status in ("active", "grace_period")
    return {
        "subscribed":   is_active,
        "tier":         "pro" if is_active else "free",
        "status":       sub.status,
        "product_id":   sub.product_id,
        "expires_date": sub.expires_date.isoformat() if sub.expires_date else None,
        "auto_renew":   sub.auto_renew_status,
        "environment":  sub.environment,
    }


# ── POST /subscriptions/restore ──────────────────────────────────────────────

@router.post("/restore")
async def restore_purchases(
    body:         RestoreIn,
    current_user: dict = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """
    Restore purchases for a user (e.g., after reinstall or new device).
    Re-verifies each provided original_transaction_id with Apple.
    """
    user_id = current_user["id"]
    restored = 0

    for orig_tx_id in body.original_transaction_ids[:10]:  # max 10
        statuses = await get_subscription_statuses(orig_tx_id)
        if not statuses:
            # Provisional restore
            await _upsert_subscription(db, user_id, {
                "original_transaction_id": orig_tx_id,
                "subscription_status":     "active",
            })
            restored += 1
        else:
            for group in statuses:
                for item in group.get("lastTransactions", []):
                    if item.get("status") == 1:  # active
                        from services.apple_iap import verify_jws_payload
                        try:
                            tx = verify_jws_payload(item["signedTransactionInfo"])
                        except Exception:
                            continue
                        await _upsert_subscription(db, user_id, {
                            "original_transaction_id": tx.get("originalTransactionId", orig_tx_id),
                            "product_id":              tx.get("productId", ""),
                            "subscription_status":     "active",
                        })
                        restored += 1

    await db.commit()
    return {"restored": restored, "message": f"{restored} subscription(s) restored"}
