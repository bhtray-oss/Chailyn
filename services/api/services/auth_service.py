"""
auth_service.py
Argon2id password hashing + JWT access/refresh token management.

Security standards:
  • Argon2id (RFC 9106 recommended) — memory-hard, side-channel resistant
  • Salt: automatically embedded by argon2-cffi (16-byte random salt per hash)
  • JWT access  token: 15-min expiry, HS256, signed with APP_SECRET_KEY
  • JWT refresh token: 30-day expiry, stored as SHA-256 hash in DB
"""

from __future__ import annotations
import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from jose import jwt, JWTError

# ── Argon2id parameters (OWASP recommended minimums) ─────────────────────────
# time_cost=3 (iterations), memory_cost=65536 (64 MB), parallelism=4
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65_536,   # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
    encoding="utf-8",
)

# ── JWT settings ──────────────────────────────────────────────────────────────
_SECRET_KEY  = os.environ.get("APP_SECRET_KEY", "dev-only-change-in-production-32chars!")
_ALGORITHM   = "HS256"
_ACCESS_TTL  = int(os.environ.get("JWT_ACCESS_TTL_MINUTES",  "15"))   # minutes
_REFRESH_TTL = int(os.environ.get("JWT_REFRESH_TTL_DAYS",    "30"))   # days


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """
    Hash a plaintext password using Argon2id.
    Returns the full PHC-formatted string (includes algorithm, params, salt, hash).
    Safe to store directly in the database.

    Example output:
      $argon2id$v=19$m=65536,t=3,p=4$<base64-salt>$<base64-hash>
    """
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify a plaintext password against a stored Argon2id hash.
    Returns True if match, False if mismatch.
    Raises ValueError on invalid hash format.
    """
    try:
        return _ph.verify(hashed, plain)
    except VerifyMismatchError:
        return False
    except (VerificationError, InvalidHashError) as exc:
        raise ValueError(f"Invalid password hash format: {exc}") from exc


def password_needs_rehash(hashed: str) -> bool:
    """
    Returns True if the hash was created with old parameters and should be
    re-hashed on next successful login (transparent upgrade path).
    """
    return _ph.check_needs_rehash(hashed)


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(user_id: str, email: str, role: str = "user") -> str:
    """
    Create a short-lived JWT access token.
    Payload: sub (user_id), email, role, exp, iat, type=access
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub":   user_id,
        "email": email,
        "role":  role,
        "type":  "access",
        "iat":   now,
        "exp":   now + timedelta(minutes=_ACCESS_TTL),
    }
    return jwt.encode(payload, _SECRET_KEY, algorithm=_ALGORITHM)


def create_refresh_token() -> tuple[str, str]:
    """
    Create a cryptographically random refresh token.
    Returns (raw_token, sha256_hash_for_db).

    The raw token is sent to the client (store in HttpOnly cookie or Keychain).
    Only the SHA-256 hash is stored in the database.
    """
    raw = secrets.token_urlsafe(48)          # 48 bytes → 64-char URL-safe string
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def refresh_token_hash(raw: str) -> str:
    """Hash a raw refresh token for DB lookup."""
    return hashlib.sha256(raw.encode()).hexdigest()


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT access token.
    Returns payload dict or None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def refresh_token_expires_at() -> datetime:
    """Return the expiry datetime for a new refresh token."""
    return datetime.now(timezone.utc) + timedelta(days=_REFRESH_TTL)
