# Chailyn App — 雲端部署指南

方案：**Vercel（前端）+ Railway（後端兩個服務）+ Supabase（PostgreSQL）**

---

## 準備工作

1. 確保程式碼已 push 到 GitHub（repository 必須是你自己的帳號底下）
2. 準備好 Anthropic API Key：`sk-ant-...`

---

## Step 1 — Supabase（資料庫）

1. 前往 [supabase.com](https://supabase.com) → New project
2. 記下：
   - **Host**：`db.<ref>.supabase.co`
   - **Database password**（你設定的）
3. 在 Supabase **SQL Editor** 執行以下指令啟用 pgvector：
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. 接著貼上整個 `db/schema.sql` 內容並執行（建立所有資料表）
5. 執行 seed 資料（開發用戶 + pattern_catalog）：
   ```sql
   -- 內容在 db/seed.sql（如果沒有，從本機執行：psql <連線字串> < db/schema.sql）
   ```
6. 取得連線字串：
   ```
   postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```
   ⚠️ 注意：asyncpg 需使用 **Transaction mode pooler**（port 6543）

---

## Step 2 — Railway pattern-engine

1. 前往 [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. 選擇你的 repo，**Root Directory** 設為 `services/pattern-engine`
3. Railway 會自動偵測 `Dockerfile`
4. 環境變數（無需設定，預設即可）
5. Deploy 後記下 Public URL：`https://pattern-engine-xxx.railway.app`

---

## Step 3 — Railway API

1. 在同一個 Railway project → New Service → Deploy from GitHub repo
2. Root Directory 設為 `services/api`
3. Railway 會自動偵測 `Dockerfile` 和 `railway.toml`
4. 設定**環境變數**：

   | Key | Value |
   |-----|-------|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `DATABASE_URL` | Step 1 取得的 asyncpg 連線字串 |
   | `PATTERN_ENGINE_URL` | Step 2 的 URL |
   | `UPLOAD_DIR` | `/data/uploads` |

5. 在 Service Settings → **Volumes** → Add Volume，Mount Path = `/data/uploads`
6. Deploy 後記下 Public URL：`https://api-xxx.railway.app`
7. 測試：`curl https://api-xxx.railway.app/health` → 應回傳 `{"status":"ok"}`

---

## Step 4 — Vercel（前端）

1. 前往 [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. **Root Directory** 設為 `apps/web`
3. Framework 自動偵測為 Next.js
4. 設定**環境變數**：

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | Step 3 的 Railway API URL |

5. Deploy

---

## Step 5 — 重建搜尋索引

部署完成後，需要為 pattern_catalog 建立向量索引（只需執行一次）：

```bash
curl -X POST https://api-xxx.railway.app/search/reindex
```

---

## 更新部署

- **前端**：push 到 GitHub main branch → Vercel 自動重新 deploy
- **後端**：push 到 GitHub → Railway 自動重新 deploy

---

## 費用估計（月）

| 服務 | 方案 | 費用 |
|------|------|------|
| Vercel | Hobby（免費）| $0 |
| Railway API | Starter | ~$5–10 USD |
| Railway pattern-engine | Starter | ~$5–10 USD |
| Supabase | Free tier（500MB）| $0 |
| **合計** | | **~$10–20 USD/月** |

---

## 常見問題

**Q: Railway deploy 失敗，看到 `ModuleNotFoundError`**
A: 確認 `services/api/requirements.txt` 包含所有套件。本機執行 `pip freeze > requirements.txt`。

**Q: Supabase 連線逾時**
A: 使用 Transaction mode pooler（port 6543），不要用 Direct connection（port 5432）。

**Q: 照片上傳後分析失敗**
A: 確認 Railway API 服務的 `UPLOAD_DIR` 環境變數已設為 `/data/uploads`，且 Volume 已正確掛載。

**Q: 前端看到 CORS 錯誤**
A: 在 `services/api/main.py` 的 `allow_origins` 加入 Vercel 的 URL。
