import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppShell } from '@/components/Nav'

export const metadata: Metadata = {
  title:       'Chailyn — AI 服裝設計 × 個人化打版',
  description: '上傳照片，30 秒取得材質 + 剪裁 + 版型三合一分析，輸出可列印紙樣',
  appleWebApp: {
    capable:          true,
    statusBarStyle:   'default',
    title:            'Chailyn',
  },
}

export const viewport: Viewport = {
  width:               'device-width',
  initialScale:        1,
  maximumScale:        1,
  userScalable:        false,           // 防止雙指縮放（App 感）
  viewportFit:         'cover',         // 延伸至 iPhone 瀏海/圓角
  themeColor:          '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased overscroll-none">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
