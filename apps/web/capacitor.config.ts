import type { CapacitorConfig } from '@capacitor/cli'

/**
 * 模式說明：
 *
 * 【開發模式 - 模擬器/實機】
 *   取消 server.url 的 localhost 那行的註解。
 *   確保 iPhone/iPad 與 Mac 在同一 Wi-Fi，並將 192.168.x.x 換成你的 Mac IP。
 *   執行：pnpm dev（背景跑 Next.js），然後 pnpm cap:run
 *
 * 【正式模式 - TestFlight / App Store】
 *   將 server.url 設為 Vercel 生產 URL。
 *   這樣 App 開啟時會載入線上版本，無需重新打包即可更新內容。
 *
 * 【完全離線模式】
 *   刪除 server 區塊，執行 pnpm cap:build 產生靜態檔案後再 pnpm cap:sync。
 *   注意：/api/recommendations 在離線模式下需改由 FastAPI 提供。
 */

const config: CapacitorConfig = {
  appId:   'app.chailyn.ios',
  appName: 'Chailyn',
  webDir:  'out',

  server: {
    // ── 開發用（模擬器）：直接連本機 Next.js dev server
    url: 'http://localhost:3000',
    cleartext: true,

    // ── 實機開發：換成你的 Mac 區網 IP（System Preferences → Network）
    // url: 'http://192.168.x.x:3000',

    // ── 正式部署：Vercel 生產 URL（取消下一行註解）
    // url: 'https://your-chailyn-app.vercel.app',
    // cleartext: false,

    allowNavigation: ['*.railway.app', '*.vercel.app', 'localhost'],
  },

  ios: {
    scheme:            'Chailyn',
    contentInset:      'automatic',
    backgroundColor:   '#fafaf9',
    allowsLinkPreview: false,
  },
}

export default config
