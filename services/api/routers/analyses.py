"""
analyses.py — 服裝照片上傳 + AI 分析路由

POST /analyses/upload        — 上傳照片，取得 photo_id（持久化存檔）
POST /analyses/jobs          — 建立非同步分析 Job
GET  /analyses/jobs/{job_id} — 輪詢 Job 狀態
GET  /analyses/{id}          — 取得分析結果（舊版相容）
"""
import uuid
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

from db.database import get_db
from services.claude_vision import analyze_garment_photo

router = APIRouter()

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_MB = 10

# 持久化上傳目錄（不用 /tmp，重啟後不會消失）
UPLOAD_DIR = Path.home() / ".chailyn" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class JobRequest(BaseModel):
    photo_id: uuid.UUID
    user_id:  uuid.UUID


# ─── 上傳照片（持久化） ───────────────────────────────────────────────────────
@router.post("/upload")
async def upload_photo(
    user_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"不支援的圖片格式: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"檔案超過 {MAX_SIZE_MB}MB 限制")

    photo_id   = uuid.uuid4()
    r2_key     = f"photos/{user_id}/{photo_id}"
    local_path = UPLOAD_DIR / str(photo_id)
    local_path.write_bytes(data)

    # 寫入 garment_photos
    await db.execute(
        text("""
            INSERT INTO garment_photos (id, user_id, r2_key, mime_type, file_size_kb)
            VALUES (:id, :user_id, :r2_key, :mime_type, :size_kb)
        """),
        {
            "id":       str(photo_id),
            "user_id":  str(user_id),
            "r2_key":   r2_key,
            "mime_type": file.content_type,
            "size_kb":  len(data) // 1024,
        },
    )

    # 寫入 assets 追蹤
    await db.execute(
        text("""
            INSERT INTO assets (id, user_id, kind, local_path, original_name, mime_type, file_size_kb)
            VALUES (:id, :user_id, 'photo', :path, :name, :mime, :size_kb)
        """),
        {
            "id":      str(uuid.uuid4()),
            "user_id": str(user_id),
            "path":    str(local_path),
            "name":    file.filename,
            "mime":    file.content_type,
            "size_kb": len(data) // 1024,
        },
    )
    await db.commit()

    return {
        "photo_id": str(photo_id),
        "r2_key":   r2_key,
        "size_kb":  len(data) // 1024,
    }


# ─── 建立非同步分析 Job ───────────────────────────────────────────────────────
@router.post("/jobs")
async def create_job(
    req: JobRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # 確認照片存在
    result = await db.execute(
        text("SELECT id FROM garment_photos WHERE id = :id AND user_id = :uid"),
        {"id": str(req.photo_id), "uid": str(req.user_id)},
    )
    if not result.fetchone():
        raise HTTPException(404, "找不到該照片")

    job_id = uuid.uuid4()
    await db.execute(
        text("""
            INSERT INTO analysis_jobs (id, user_id, photo_id, status)
            VALUES (:id, :user_id, :photo_id, 'pending')
        """),
        {"id": str(job_id), "user_id": str(req.user_id), "photo_id": str(req.photo_id)},
    )
    await db.commit()

    # 在背景執行真正的 AI 分析（不阻塞 HTTP response）
    background_tasks.add_task(_run_analysis, str(job_id), str(req.photo_id), str(req.user_id))

    return {"job_id": str(job_id), "status": "pending"}


# ─── 輪詢 Job 狀態 ────────────────────────────────────────────────────────────
@router.get("/jobs/{job_id}")
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT id, user_id, photo_id, status, result, error,
                   analysis_id, created_at, started_at, finished_at
            FROM analysis_jobs WHERE id = :id
        """),
        {"id": str(job_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到 Job")
    return dict(row._mapping)


# ─── 舊版同步分析（保留相容性） ───────────────────────────────────────────────
@router.post("/analyze")
async def analyze_sync(
    req: JobRequest,
    db: AsyncSession = Depends(get_db),
):
    """舊版同步 API，建議改用 /jobs 非同步版本。"""
    result = await db.execute(
        text("SELECT r2_key, mime_type FROM garment_photos WHERE id = :id AND user_id = :uid"),
        {"id": str(req.photo_id), "uid": str(req.user_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到該照片")

    local_path = UPLOAD_DIR / str(req.photo_id)
    if not local_path.exists():
        raise HTTPException(404, "圖片已過期或不存在，請重新上傳")

    image_bytes = local_path.read_bytes()
    mime_type   = row.mime_type

    try:
        analysis = await analyze_garment_photo(image_bytes, mime_type)
    except Exception as e:
        err_str = str(e)
        if "credit balance is too low" in err_str or "billing" in err_str.lower():
            raise HTTPException(402, "Anthropic 帳戶餘額不足，請至 console.anthropic.com 加值")
        raise HTTPException(502, f"AI 分析失敗: {err_str}")

    analysis_id = uuid.uuid4()
    await db.execute(
        text("""
            INSERT INTO ai_analyses (id, photo_id, raw_output, closest_patterns, silhouette_tags)
            VALUES (:id, :photo_id, CAST(:raw AS JSONB), CAST(:patterns AS JSONB), :tags)
        """),
        {
            "id":       str(analysis_id),
            "photo_id": str(req.photo_id),
            "raw":      json.dumps(analysis),
            "patterns": json.dumps(analysis.get("closest_freesewing_patterns", [])),
            "tags":     analysis.get("silhouette_tags", []),
        },
    )
    await db.commit()

    return {"analysis_id": str(analysis_id), "result": analysis}


# ─── 列出使用者所有分析記錄 ───────────────────────────────────────────────────
@router.get("/user/{user_id}")
async def list_user_analyses(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """回傳該 user 所有已完成的分析 job（含照片 meta + 結果摘要），最新在前。"""
    result = await db.execute(
        text("""
            SELECT
                j.id          AS job_id,
                j.photo_id,
                j.status,
                j.result,
                j.analysis_id,
                j.created_at,
                j.finished_at,
                p.mime_type,
                p.file_size_kb
            FROM analysis_jobs j
            JOIN garment_photos p ON p.id = j.photo_id
            WHERE j.user_id = :uid
              AND j.status = 'done'
            ORDER BY j.created_at DESC
            LIMIT 100
        """),
        {"uid": str(user_id)},
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


# ─── 提供照片縮圖（本地檔案回傳） ─────────────────────────────────────────────
@router.get("/photo/{photo_id}")
async def get_photo(
    photo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """回傳原始上傳圖片，供前端顯示縮圖。"""
    result = await db.execute(
        text("SELECT mime_type FROM garment_photos WHERE id = :id"),
        {"id": str(photo_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到照片記錄")

    local_path = UPLOAD_DIR / str(photo_id)
    if not local_path.exists():
        raise HTTPException(404, "照片檔案不存在")

    return FileResponse(str(local_path), media_type=row.mime_type)


# ─── 刪除分析記錄 ─────────────────────────────────────────────────────────────
@router.delete("/jobs/{job_id}")
async def delete_analysis_job(
    job_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """刪除指定 job 及其關聯的 ai_analyses 記錄（照片保留）。"""
    result = await db.execute(
        text("SELECT photo_id, analysis_id FROM analysis_jobs WHERE id = :id AND user_id = :uid"),
        {"id": str(job_id), "uid": str(user_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到記錄或無權限刪除")

    # 刪除 ai_analyses
    if row.analysis_id:
        await db.execute(
            text("DELETE FROM ai_analyses WHERE id = :id"),
            {"id": str(row.analysis_id)},
        )

    # 刪除 job
    await db.execute(
        text("DELETE FROM analysis_jobs WHERE id = :id"),
        {"id": str(job_id)},
    )
    await db.commit()
    return {"deleted": str(job_id)}


# ─── 取得分析結果 ─────────────────────────────────────────────────────────────
@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT * FROM ai_analyses WHERE id = :id"),
        {"id": str(analysis_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到分析結果")
    return dict(row._mapping)


# ─── 背景 Task：執行 AI 分析並更新 Job 狀態 ───────────────────────────────────
async def _run_analysis(job_id: str, photo_id: str, user_id: str):
    """
    此函式在 FastAPI BackgroundTasks 中執行，不能直接接受 db session，
    需要自行建立新的 session。
    """
    from db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        # 標記 running
        await db.execute(
            text("UPDATE analysis_jobs SET status='running', started_at=now() WHERE id=:id"),
            {"id": job_id},
        )
        await db.commit()

        try:
            # 讀取照片
            result = await db.execute(
                text("SELECT mime_type FROM garment_photos WHERE id = :id"),
                {"id": photo_id},
            )
            row = result.fetchone()
            if not row:
                raise ValueError("找不到照片記錄")

            local_path = UPLOAD_DIR / photo_id
            if not local_path.exists():
                raise FileNotFoundError("圖片檔案不存在，請重新上傳")

            image_bytes = local_path.read_bytes()
            mime_type   = row.mime_type

            # Claude Vision 分析
            analysis = await analyze_garment_photo(image_bytes, mime_type)

            # 計算語意 embedding（非同步，失敗不影響主流程）
            fabric_vec_str, cut_vec_str = None, None
            try:
                from services.embeddings import embed_analysis
                vecs = embed_analysis(analysis)
                fabric_vec_str = "[" + ",".join(str(v) for v in vecs["fabric"]) + "]"
                cut_vec_str    = "[" + ",".join(str(v) for v in vecs["cut"])    + "]"
            except Exception as emb_err:
                print(f"[embedding] Warning: {emb_err}")

            # 存入 ai_analyses（含 embedding）
            analysis_id = uuid.uuid4()
            await db.execute(
                text("""
                    INSERT INTO ai_analyses
                      (id, photo_id, raw_output, closest_patterns, silhouette_tags,
                       fabric_embed, cut_embed)
                    VALUES
                      (:id, :photo_id, CAST(:raw AS JSONB), CAST(:patterns AS JSONB), :tags,
                       CAST(:fvec AS vector), CAST(:cvec AS vector))
                """),
                {
                    "id":       str(analysis_id),
                    "photo_id": photo_id,
                    "raw":      json.dumps(analysis),
                    "patterns": json.dumps(analysis.get("closest_freesewing_patterns", [])),
                    "tags":     analysis.get("silhouette_tags", []),
                    "fvec":     fabric_vec_str,
                    "cvec":     cut_vec_str,
                },
            )

            # Job 標記 done
            await db.execute(
                text("""
                    UPDATE analysis_jobs
                    SET status='done', result=CAST(:result AS JSONB),
                        analysis_id=:analysis_id, finished_at=now()
                    WHERE id=:id
                """),
                {
                    "result":      json.dumps(analysis),
                    "analysis_id": str(analysis_id),
                    "id":          job_id,
                },
            )
            await db.commit()

        except Exception as e:
            await db.execute(
                text("""
                    UPDATE analysis_jobs
                    SET status='failed', error=:error, finished_at=now()
                    WHERE id=:id
                """),
                {"error": str(e), "id": job_id},
            )
            await db.commit()
