"""
auth.py — 簡單 JWT auth（MVP 版；正式版整合 Clerk）
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid

from db.database import get_db

router = APIRouter()


class RegisterIn(BaseModel):
    email: str
    display_name: str = ""


@router.post("/register")
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    user_id = uuid.uuid4()
    try:
        await db.execute(
            text("INSERT INTO users (id, email, display_name) VALUES (:id, :email, :name)"),
            {"id": str(user_id), "email": body.email, "name": body.display_name},
        )
        await db.commit()
    except Exception:
        raise HTTPException(409, "Email 已存在")
    return {"user_id": str(user_id), "email": body.email}


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
