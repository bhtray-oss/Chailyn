"""
Chailyn FreeSewing APP · FastAPI 主入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import analyses, body_profiles, patterns, auth, search, bom

app = FastAPI(
    title="Chailyn API",
    version="0.1.0",
    description="AI 服裝分析 × 個人化打版後端",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://chailyn.app"],
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


@app.get("/health")
async def health():
    return {"status": "ok"}
