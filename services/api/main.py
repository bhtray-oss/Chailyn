"""
Chailyn FreeSewing APP · FastAPI 主入口
"""
import asyncio
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import analyses, body_profiles, patterns, auth, search, bom, catalog, garmentcode


def _warmup_embedding_model():
    """
    在背景執行緒中預先載入 sentence-transformers 模型（~180MB）。
    避免第一次分析時多等 3–5 秒。
    """
    try:
        from services.embeddings import _get_model
        _get_model()
        print("[startup] Embedding model warmed up ✓")
    except Exception as e:
        print(f"[startup] Embedding warm-up skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 啟動時在背景執行緒預熱 embedding 模型（不阻塞 API 啟動）
    threading.Thread(target=_warmup_embedding_model, daemon=True).start()
    yield


app = FastAPI(
    title="Chailyn API",
    version="0.1.0",
    description="AI 服裝分析 × 個人化打版後端",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://chailyn.app",
        "https://*.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,          prefix="/auth",     tags=["auth"])
app.include_router(analyses.router,      prefix="/analyses", tags=["analyses"])
app.include_router(body_profiles.router, prefix="/profiles", tags=["profiles"])
app.include_router(patterns.router,      prefix="/patterns", tags=["patterns"])
app.include_router(search.router,        prefix="/search",   tags=["search"])
app.include_router(bom.router,           prefix="/bom",      tags=["bom"])
app.include_router(catalog.router,       prefix="/catalog",      tags=["catalog"])
app.include_router(garmentcode.router,   prefix="/garmentcode",  tags=["garmentcode"])


@app.get("/health")
async def health():
    return {"status": "ok"}
