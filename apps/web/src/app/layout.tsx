import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/Nav'

export const metadata: Metadata = {
  title: "Chailyn — AI 服裝設計 × 個人化打版",
  description: "上傳照片，30 秒取得材質 + 剪裁 + 版型三合一分析，輸出可列印紙樣",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
