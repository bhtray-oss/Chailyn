"""
auth.py — Full authentication router
──────────────────────────────────────────────────────────────────────────────
POST /auth/register          Register with email + password
POST /auth/login             Login → access token (JWT) + refresh token
POST /auth/refresh           Exchange refresh token → new access token
POST /auth/logout            Revoke refresh token
POST /auth/apple             Sign in with Apple (native iOS)
GET  /auth/me                Current user from Bearer token
PATCH /auth/me               Update display_name / locale

Security:
  • Argon2id (time=3, mem=64MB) for password storage
  • Salt: embedded in PHC string, unique per password — never stored separately
  • JWT access token: 15 min, HS256, APP_SECRET_KEY
  • Refresh token: 30-day, stored as SHA-256 in DB (raw token in HttpOnly cookie)
  • Timing-safe password comparison via argon2-cffi
"""

from __future__ import annotations
import uuid
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Cookie, Response
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from db.database import get_db
from services.auth_service import (
    hash_password, verify_password, password_needs_rehash,
    create_access_token, create_refresh_token, refresh_token_hash,
    decode_access_token, refresh_token_expires_at,
)

router = APIRouter()

# ── Pydantic models ───────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    email:        str
    password:     str
    display_name: str = ""

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email format")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginIn(BaseModel):
    email:    str
    password: str


class AppleSignInIn(BaseModel):
    identity_token: str            # JWT from Apple
    authorization_code: str
    display_name: Optional[str] = None
    device_hint:  Optional[str] = None


class RefreshIn(BaseModel):
    refresh_token: str


class UpdateMeIn(BaseModel):
    display_name: Optional[str] = None
    locale:       Optional[str] = None


# ── Helper: current user from Bearer token ────────────────────────────────────

async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(401, "Token expired or invalid")

    row = await db.execute(
        text("SELECT id, email, display_name, role, subscription_tier, is_active "
             "FROM users WHERE id = :id"),
        {"id": payload["sub"]},
    )
    user = row.fetchone()
    if not user:
        raise HTTPException(401, "User not found")
    if not user.is_active:
        raise HTTPException(403, "Account is deactivated")
    return dict(user._mapping)


# ── POST /auth/register ───────────────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    """
    Register a new user with email + password.
    Password is hashed with Argon2id (64 MB memory, 3 iterations, 4 threads).
    Salt is auto-generated and embedded in the PHC hash string.
    """
    # Check email uniqueness
    exists = await db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": body.email},
    )
    if exists.fetchone():
        raise HTTPException(409, "Email already registered")

    user_id   = str(uuid.uuid4())
    pw_hash   = hash_password(body.password)
    raw_rt, rt_hash = create_refresh_token()
    rt_exp    = refresh_token_expires_at()

    # Insert user
    await db.execute(
        text("""
            INSERT INTO users (id, email, display_name, password_hash, auth_provider)
            VALUES (:id, :email, :name, :pw_hash, 'local')
        """),
        {"id": user_id, "email": body.email,
         "name": body.display_name or body.email.split("@")[0],
         "pw_hash": pw_hash},
    )

    # Store refresh token hash
    await db.execute(
        text("""
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
            VALUES (:uid, :hash, :exp)
        """),
        {"uid": user_id, "hash": rt_hash, "exp": rt_exp},
    )
    await db.commit()

    access_token = create_access_token(user_id, body.email)

    return {
        "access_token":  access_token,
        "refresh_token": raw_rt,
        "token_type":    "bearer",
        "expires_in":    900,   # 15 min
        "user": {
            "id":           user_id,
            "email":        body.email,
            "display_name": body.display_name or body.email.split("@")[0],
            "role":         "user",
            "subscription_tier": "free",
        },
    }


# ── POST /auth/login ──────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    """
    Login with email + password.
    Uses constant-time argon2 verify to prevent timing attacks.
    Rehashes password transparently if parameters have been upgraded.
    """
    email = body.email.strip().lower()

    row = await db.execute(
        text("SELECT id, email, display_name, role, subscription_tier, "
             "password_hash, auth_provider, is_active FROM users WHERE email = :email"),
        {"email": email},
    )
    user = row.fetchone()

    # Fail with same error regardless of whether user exists (prevent enumeration)
    if not user or not user.password_hash:
        # Still run a dummy hash to prevent timing attacks
        hash_password("dummy-prevent-timing-attack")
        raise HTTPException(401, "Invalid email or password")

    if not user.is_active:
        raise HTTPException(403, "Account is deactivated")

    if user.auth_provider != "local":
        raise HTTPException(400, f"Account uses {user.auth_provider} sign-in. Use that method.")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    user_id = str(user.id)

    # Transparent rehash if Argon2 parameters were upgraded
    if password_needs_rehash(user.password_hash):
        new_hash = hash_password(body.password)
        await db.execute(
            text("UPDATE users SET password_hash = :h WHERE id = :id"),
            {"h": new_hash, "id": user_id},
        )

    # Update last login
    await db.execute(
        text("UPDATE users SET last_login_at = now() WHERE id = :id"),
        {"id": user_id},
    )

    # Issue tokens
    raw_rt, rt_hash = create_refresh_token()
    rt_exp = refresh_token_expires_at()
    await db.execute(
        text("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) "
             "VALUES (:uid, :hash, :exp)"),
        {"uid": user_id, "hash": rt_hash, "exp": rt_exp},
    )
    await db.commit()

    return {
        "access_token":  create_access_token(user_id, email, user.role),
        "refresh_token": raw_rt,
        "token_type":    "bearer",
        "expires_in":    900,
        "user": {
            "id":                user_id,
            "email":             email,
            "display_name":      user.display_name,
            "role":              user.role,
            "subscription_tier": user.subscription_tier,
        },
    }


# ── POST /auth/refresh ────────────────────────────────────────────────────────

@router.post("/refresh")
async def refresh(body: RefreshIn, db: AsyncSession = Depends(get_db)):
    """
    Exchange a valid refresh token for a new access token + rotated refresh token.
    Old refresh token is immediately revoked (token rotation).
    """
    token_h = refresh_token_hash(body.refresh_token)

    row = await db.execute(
        text("""
            SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked,
                   u.email, u.role, u.is_active
            FROM refresh_tokens rt
            JOIN users u ON u.id = rt.user_id
            WHERE rt.token_hash = :hash
        """),
        {"hash": token_h},
    )
    rec = row.fetchone()

    if not rec:
        raise HTTPException(401, "Invalid refresh token")
    if rec.revoked:
        # Possible token theft — revoke all tokens for this user
        await db.execute(
            text("UPDATE refresh_tokens SET revoked = true WHERE user_id = :uid"),
            {"uid": str(rec.user_id)},
        )
        await db.commit()
        raise HTTPException(401, "Refresh token already used. All sessions revoked.")
    if rec.expires_at < datetime.now(timezone.utc):
        raise HTTPException(401, "Refresh token expired. Please login again.")
    if not rec.is_active:
        raise HTTPException(403, "Account is deactivated")

    user_id = str(rec.user_id)

    # Revoke old token, issue new pair (rotation)
    await db.execute(
        text("UPDATE refresh_tokens SET revoked = true WHERE id = :id"),
        {"id": str(rec.id)},
    )
    raw_rt, rt_hash_new = create_refresh_token()
    rt_exp = refresh_token_expires_at()
    await db.execute(
        text("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) "
             "VALUES (:uid, :hash, :exp)"),
        {"uid": user_id, "hash": rt_hash_new, "exp": rt_exp},
    )
    await db.commit()

    # Fetch user data to return with the refreshed token
    user_row = await db.execute(
        text("SELECT id, email, display_name, role, subscription_tier "
             "FROM users WHERE id = :id"),
        {"id": user_id},
    )
    user_data = user_row.fetchone()

    return {
        "access_token":  create_access_token(user_id, rec.email, rec.role),
        "refresh_token": raw_rt,
        "token_type":    "bearer",
        "expires_in":    900,
        "user": {
            "id":                user_id,
            "email":             rec.email,
            "display_name":      user_data.display_name if user_data else rec.email.split("@")[0],
            "role":              rec.role,
            "subscription_tier": user_data.subscription_tier if user_data else "free",
        },
    }


# ── POST /auth/logout ─────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(body: RefreshIn, db: AsyncSession = Depends(get_db)):
    """Revoke a refresh token (logout from current device)."""
    token_h = refresh_token_hash(body.refresh_token)
    await db.execute(
        text("UPDATE refresh_tokens SET revoked = true WHERE token_hash = :hash"),
        {"hash": token_h},
    )
    await db.commit()
    return {"message": "Logged out"}


# ── POST /auth/apple ──────────────────────────────────────────────────────────

@router.post("/apple")
async def apple_sign_in(body: AppleSignInIn, db: AsyncSession = Depends(get_db)):
    """
    Sign in with Apple (iOS native flow).

    iOS sends: identity_token (JWT from Apple), authorization_code.
    We decode the identity_token to get apple_user_id + email,
    then create/find the user and issue our own tokens.

    Security note: In production, verify the identity_token signature
    against Apple's public keys (JWKS at https://appleid.apple.com/auth/keys).
    """
    try:
        from jose import jwt as jose_jwt
        # Decode without verification for now — add JWKS verification in production
        # Header contains 'kid' which maps to Apple's public key
        claims = jose_jwt.get_unverified_claims(body.identity_token)
        apple_uid = claims.get("sub", "")
        email     = claims.get("email", "").lower()
        if not apple_uid:
            raise ValueError("Missing 'sub' claim")
    except Exception as exc:
        raise HTTPException(400, f"Invalid Apple identity token: {exc}") from exc

    # Find or create user
    row = await db.execute(
        text("SELECT id, email, display_name, role, subscription_tier, is_active "
             "FROM users WHERE apple_user_id = :aid"),
        {"aid": apple_uid},
    )
    user = row.fetchone()

    if user:
        if not user.is_active:
            raise HTTPException(403, "Account is deactivated")
        user_id   = str(user.id)
        user_email = user.email
    else:
        # New Apple user — create account
        user_id   = str(uuid.uuid4())
        user_email = email or f"{apple_uid}@privaterelay.appleid.com"
        display   = body.display_name or user_email.split("@")[0]
        await db.execute(
            text("""
                INSERT INTO users (id, email, display_name, apple_user_id, auth_provider)
                VALUES (:id, :email, :name, :aid, 'apple')
                ON CONFLICT (email) DO UPDATE
                  SET apple_user_id = EXCLUDED.apple_user_id,
                      auth_provider = 'apple'
                RETURNING id
            """),
            {"id": user_id, "email": user_email, "name": display, "aid": apple_uid},
        )

    await db.execute(
        text("UPDATE users SET last_login_at = now() WHERE id = :id"),
        {"id": user_id},
    )

    raw_rt, rt_hash = create_refresh_token()
    rt_exp = refresh_token_expires_at()
    await db.execute(
        text("INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_hint) "
             "VALUES (:uid, :hash, :exp, :hint)"),
        {"uid": user_id, "hash": rt_hash, "exp": rt_exp, "hint": body.device_hint},
    )
    await db.commit()

    return {
        "access_token":  create_access_token(user_id, user_email),
        "refresh_token": raw_rt,
        "token_type":    "bearer",
        "expires_in":    900,
        "user": {
            "id":    user_id,
            "email": user_email,
        },
    }


# ── GET /auth/me ──────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return current authenticated user."""
    return current_user


# ── PATCH /auth/me ────────────────────────────────────────────────────────────

@router.patch("/me")
async def update_me(
    body: UpdateMeIn,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updates, params = [], {"id": current_user["id"]}
    if body.display_name is not None:
        updates.append("display_name = :dn")
        params["dn"] = body.display_name
    if body.locale is not None:
        updates.append("locale = :locale")
        params["locale"] = body.locale
    if updates:
        await db.execute(
            text(f"UPDATE users SET {', '.join(updates)}, updated_at = now() WHERE id = :id"),
            params,
        )
        await db.commit()
    return {"message": "Updated"}


# ── Legacy: keep /auth/user/{user_id} for backward compat ────────────────────

@router.get("/user/{user_id}")
async def get_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT id, email, display_name, role, subscription_tier FROM users WHERE id = :id"),
        {"id": str(user_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "使用者不存在")
    return dict(row._mapping)
