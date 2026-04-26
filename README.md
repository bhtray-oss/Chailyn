# Chailyn FreeSewing APP

AI 服裝分析 × 個人化設計 × 打版輸出  
**Stack**: Next.js 14 · FastAPI · FreeSewing v4.8.0 · Claude Vision · PostgreSQL + pgvector

---

## 專案結構

```
chailyn-app/
├── apps/
│   ├── web/              # Next.js 14 + TypeScript + Tailwind
│   └── mobile/           # Expo (React Native)
├── services/
│   ├── api/              # FastAPI (Python) — 主後端
│   └── pattern-engine/   # Node.js — FreeSewing 打版服務
├── docker-compose.yml    # 一鍵啟動開發環境
└── .env.example
```

---

## 快速啟動

### 1. 安裝前置需求

- Node.js 20+
- Python 3.12+
- pnpm 9+
- Docker + Docker Compose

### 2. 設定環境變數

```bash
cp .env.example .env
# 填入 ANTHROPIC_API_KEY 等必填值
```

### 3. 啟動資料庫（Docker）

```bash
docker-compose up db -d
# 等待 DB 就緒後，schema 會自動載入
```

### 4. 啟動 pattern-engine（Node.js）

```bash
cd services/pattern-engine
npm install
npm run dev
# → http://localhost:3001
```

### 5. 啟動 API（FastAPI）

```bash
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000
# → Swagger UI: http://localhost:8000/docs
```

### 6. 啟動 Web（Next.js）

```bash
cd apps/web
pnpm install
pnpm dev
# → http://localhost:3000
```

### 7. 啟動 Mobile（Expo）

```bash
cd apps/mobile
npx expo install
npx expo start
```

---

## API 端點速覽

### pattern-engine (port 3001)

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/draft` | 打版，回傳 SVG 或 renderProps |
| POST | `/sample` | 取樣預覽（option / measurement / models）|
| POST | `/measurements/estimate` | neckstimate 補全身材資料 |
| GET  | `/designs` | 列出支援的 design 清單 |
| GET  | `/health` | 健康檢查 |

**Draft 請求範例：**
```json
{
  "design": "aaron",
  "measurements": { "chest": 960, "waist": 820, "neck": 380 },
  "options": { "chestEase": 0.1 },
  "sa": 10,
  "fillMissing": true,
  "gender": "cisMale"
}
```

### api (port 8000)

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/analyses/upload` | 上傳服裝照片 |
| POST | `/analyses/analyze` | Claude Vision 分析 |
| GET  | `/analyses/{id}` | 取得分析結果 |
| POST | `/profiles/` | 建立身材檔案（cm → mm）|
| GET  | `/profiles/{user_id}` | 列出身材檔案 |
| POST | `/patterns/draft` | 呼叫 pattern-engine 打版 |
| POST | `/patterns/sample` | 版型取樣 |
| GET  | `/patterns/catalog/list` | 版型目錄 |

---

## Claude Vision AI 分析格式

Claude Vision 輸出的 JSON schema（`closest_freesewing_patterns` 欄位）
可直接作為 `/patterns/draft` 的 `options` 參數：

```json
{
  "closest_freesewing_patterns": [
    {
      "design": "brian",
      "confidence": 0.84,
      "suggested_options": {
        "chestEase": 0.12,
        "lengthBonus": 0.05
      }
    }
  ]
}
```

---

## 版型支援清單（v4.8.0 鎖定）

| Design | 分類 | 難度 |
|--------|------|------|
| Aaron  | 上衣 | ★☆☆☆ |
| Teagan | 上衣 | ★☆☆☆ |
| Bibi   | 上衣 | ★☆☆☆ |
| Sandy  | 裙   | ★☆☆☆ |
| Waralee| 褲   | ★☆☆☆ |
| Simon  | 襯衫 | ★★★☆ |
| Simone | 襯衫 | ★★★☆ |
| Titan  | 褲   | ★★☆☆ |
| Paco   | 褲   | ★★☆☆ |
| Huey   | 帽T  | ★★☆☆ |
| Brian  | 基礎原型 | ★★☆☆ |
| Bella  | 基礎原型 | ★★☆☆ |
| Carlton| 大衣 | ★★★★ |
| Carlita| 大衣 | ★★★★ |
| Lily   | 內衣 | ★★☆☆ |

---

## 授權

程式碼：MIT  
FreeSewing 上游：MIT（codeberg.org/freesewing/freesewing）  
請在 About 頁標註「Powered by FreeSewing」
