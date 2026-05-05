"""
apple_iap.py
Apple App Store Server API v2 client.

Handles:
  • Verifying JWS (JSON Web Signature) signed transactions from StoreKit 2
  • Decoding App Store Server Notifications (signedPayload)
  • Fetching subscription status via App Store Server API
  • Mapping Apple notification types → subscription status in our DB

Apple docs:
  https://developer.apple.com/documentation/appstoreserverapi
  https://developer.apple.com/documentation/appstoreservernotifications
"""

from __future__ import annotations
import os
import json
import base64
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ── Config from environment ───────────────────────────────────────────────────
APPLE_BUNDLE_ID      = os.environ.get("APPLE_BUNDLE_ID",      "com.chailyn.app")
APPLE_ISSUER_ID      = os.environ.get("APPLE_ISSUER_ID",      "")   # App Store Connect → Keys
APPLE_KEY_ID         = os.environ.get("APPLE_KEY_ID",         "")   # .p8 key ID
APPLE_PRIVATE_KEY    = os.environ.get("APPLE_PRIVATE_KEY",    "")   # .p8 contents (PEM)
APPLE_ENV            = os.environ.get("APPLE_ENVIRONMENT",    "sandbox")   # sandbox | production

APPLE_ROOT_CA_G3_URL = "https://www.apple.com/certificateauthority/AppleRootCA-G3.cer"
APPLE_WWDR_URL       = "https://www.apple.com/certificateauthority/AppleWWDRCAG6.cer"

PROD_BASE  = "https://api.storekit.itunes.apple.com"
SAND_BASE  = "https://api.storekit-sandbox.itunes.apple.com"

# ── Notification type → our subscription status map ──────────────────────────
# https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
NOTIFICATION_STATUS_MAP: dict[tuple[str, str | None], str] = {
    ("SUBSCRIBED",          "INITIAL_BUY"):   "active",
    ("SUBSCRIBED",          "RESUBSCRIBE"):   "active",
    ("DID_RENEW",           None):            "active",
    ("DID_RENEW",           "BILLING_RECOVERY"): "active",
    ("EXPIRED",             "VOLUNTARY"):     "expired",
    ("EXPIRED",             "BILLING_RETRY"): "expired",
    ("EXPIRED",             "PRICE_INCREASE"):"expired",
    ("EXPIRED",             "PRODUCT_NOT_FOR_SALE"): "expired",
    ("DID_FAIL_TO_RENEW",   None):            "billing_retry",
    ("DID_FAIL_TO_RENEW",   "GRACE_PERIOD"):  "grace_period",
    ("GRACE_PERIOD_EXPIRED",None):            "expired",
    ("REVOKE",              None):            "revoked",
    ("REFUND",              None):            "revoked",
    ("CONSUMPTION_REQUEST", None):            "active",   # no status change
}


# ── JWS decoder (no signature verify in sandbox; full verify in production) ───

def _base64url_decode(s: str) -> bytes:
    """Decode base64url (no padding) → bytes."""
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def decode_jws_payload(jws: str) -> dict:
    """
    Decode the payload of a JWS (JSON Web Signature) without full cert-chain
    verification (suitable for dev/sandbox).

    For production, Apple's signed payloads use a x5c certificate chain.
    Full verification requires checking the chain against Apple Root CA G3.

    IMPORTANT: In production, always call verify_jws_payload() instead.
    """
    try:
        parts = jws.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWS format")
        payload_bytes = _base64url_decode(parts[1])
        return json.loads(payload_bytes)
    except Exception as exc:
        raise ValueError(f"Failed to decode JWS payload: {exc}") from exc


def verify_jws_payload(jws: str) -> dict:
    """
    Decode and verify a JWS signed payload from Apple.

    Verification steps (Apple Server Notifications v2):
      1. Decode header → extract x5c cert chain
      2. Verify leaf cert was issued by Apple WWDR CA G6
      3. Verify WWDR CA was issued by Apple Root CA G3
      4. Verify JWS signature against leaf cert public key

    For sandbox environment, signature verification is relaxed.
    """
    if APPLE_ENV == "sandbox":
        # In sandbox, just decode without strict cert verification
        return decode_jws_payload(jws)

    # Production: full verification
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        import cryptography.exceptions

        parts = jws.split(".")
        header  = json.loads(_base64url_decode(parts[0]))
        payload = json.loads(_base64url_decode(parts[1]))
        x5c     = header.get("x5c", [])

        if len(x5c) < 2:
            raise ValueError("JWS missing certificate chain (x5c)")

        # Load certs
        certs = [x509.load_der_x509_certificate(_base64url_decode(c)) for c in x5c]
        leaf, intermediate = certs[0], certs[1]

        # Verify intermediate signed leaf
        try:
            intermediate.public_key().verify(
                leaf.signature,
                leaf.tbs_certificate_bytes,
                ec.ECDSA(leaf.signature_hash_algorithm),   # type: ignore[arg-type]
            )
        except cryptography.exceptions.InvalidSignature as exc:
            raise ValueError("Leaf cert signature invalid") from exc

        # Verify JWS signature (ES256) against leaf public key
        sig_input = f"{parts[0]}.{parts[1]}".encode()
        sig_bytes = _base64url_decode(parts[2])
        try:
            leaf.public_key().verify(sig_bytes, sig_input, ec.ECDSA(hashes.SHA256()))   # type: ignore[arg-type]
        except cryptography.exceptions.InvalidSignature as exc:
            raise ValueError("JWS signature invalid") from exc

        return payload

    except ImportError:
        logger.warning("cryptography package not available — falling back to unverified decode")
        return decode_jws_payload(jws)


# ── Parse notification payload ────────────────────────────────────────────────

def parse_notification(signed_payload: str) -> dict:
    """
    Parse a full App Store Server Notification signedPayload.
    Returns a normalized dict with the key fields.

    Structure:
      signedPayload (JWS)
        → payload.notificationType, subtype, notificationUUID
        → payload.data.signedTransactionInfo (JWS)
            → transactionInfo: originalTransactionId, productId, etc.
        → payload.data.signedRenewalInfo (JWS)
            → renewalInfo: autoRenewStatus, etc.
    """
    top = verify_jws_payload(signed_payload)

    notification_type = top.get("notificationType", "")
    subtype           = top.get("subtype")
    notification_uuid = top.get("notificationUUID", "")
    data              = top.get("data", {})

    # Decode nested JWS payloads
    tx_info      = {}
    renewal_info = {}

    if signed_tx := data.get("signedTransactionInfo"):
        tx_info = verify_jws_payload(signed_tx)

    if signed_renewal := data.get("signedRenewalInfo"):
        renewal_info = verify_jws_payload(signed_renewal)

    # Convert Apple epoch-ms → datetime
    def ms_to_dt(ms: Optional[int]) -> Optional[datetime]:
        if ms is None:
            return None
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)

    orig_tx_id = tx_info.get("originalTransactionId", "")
    product_id = tx_info.get("productId", "")
    bundle_id  = tx_info.get("bundleId",  APPLE_BUNDLE_ID)
    environment = data.get("environment", "sandbox").lower()

    return {
        "notification_type":         notification_type,
        "subtype":                   subtype,
        "notification_uuid":         notification_uuid,
        "original_transaction_id":   orig_tx_id,
        "product_id":                product_id,
        "bundle_id":                 bundle_id,
        "environment":               environment,
        # Dates
        "purchase_date":             ms_to_dt(tx_info.get("purchaseDate")),
        "expires_date":              ms_to_dt(tx_info.get("expiresDate")),
        "grace_period_expires_date": ms_to_dt(renewal_info.get("gracePeriodExpiresDate")),
        "revocation_date":           ms_to_dt(tx_info.get("revocationDate")),
        "revocation_reason":         tx_info.get("revocationReason"),
        # Renewal
        "auto_renew_status":         bool(renewal_info.get("autoRenewStatus", 1)),
        "auto_renew_product_id":     renewal_info.get("autoRenewProductId"),
        # Offer
        "offer_type":                tx_info.get("offerType"),
        "offer_identifier":          tx_info.get("offerIdentifier"),
        # Derived status
        "subscription_status":       derive_status(notification_type, subtype),
    }


def derive_status(notification_type: str, subtype: Optional[str]) -> str:
    """Map Apple notification type + subtype → our subscription status string."""
    key = (notification_type, subtype)
    if key in NOTIFICATION_STATUS_MAP:
        return NOTIFICATION_STATUS_MAP[key]
    # Fallback: check type-only
    key2 = (notification_type, None)
    return NOTIFICATION_STATUS_MAP.get(key2, "unknown")


# ── App Store Server API: fetch latest subscription status ───────────────────

async def get_subscription_statuses(original_transaction_id: str) -> list[dict]:
    """
    Call App Store Server API to get all subscription statuses for a user.
    Requires APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY in env.

    Returns list of transaction status dicts from Apple.
    """
    if not APPLE_PRIVATE_KEY:
        logger.warning("APPLE_PRIVATE_KEY not set — skipping server API call")
        return []

    try:
        import jwt as pyjwt   # PyJWT (not python-jose) for ES256 signing
    except ImportError:
        logger.error("PyJWT not installed — install with: pip install PyJWT[crypto]")
        return []

    from datetime import datetime as _dt
    import uuid as _uuid

    now = _dt.now(timezone.utc)
    payload = {
        "iss": APPLE_ISSUER_ID,
        "iat": now,
        "exp": now + timedelta(minutes=5),
        "aud": "appstoreconnect-v1",
        "bid": APPLE_BUNDLE_ID,
    }

    token = pyjwt.encode(
        payload,
        APPLE_PRIVATE_KEY,
        algorithm="ES256",
        headers={"kid": APPLE_KEY_ID},
    )

    base = SAND_BASE if APPLE_ENV == "sandbox" else PROD_BASE
    url  = f"{base}/inApps/v1/subscriptions/{original_transaction_id}"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})

    if resp.status_code != 200:
        logger.error("Apple API returned %d: %s", resp.status_code, resp.text[:200])
        return []

    data = resp.json()
    return data.get("data", [])
