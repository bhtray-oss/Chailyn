import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Chailyn — AI 服裝設計 × 個人化打版",
  description: "上傳照片，30 秒取得材質 + 剪裁 + 版型三合一分析，輸出可列印紙樣",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <nav className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="font-bold text-lg tracking-tight text-stone-800">
              Chailyn
            </a>
            <div className="flex items-center gap-6 text-sm text-stone-600">
              <a href="/analyze"  className="hover:text-stone-900 transition-colors">分析照片</a>
              <a href="/history"  className="hover:text-stone-900 transition-colors">分析歷史</a>
              <a href="/search"   className="hover:text-stone-900 transition-colors">搜尋版型</a>
              <a href="/pattern"  className="hover:text-stone-900 transition-colors">版型</a>
              <a href="/wardrobe" className="hover:text-stone-900 transition-colors">衣櫃</a>
              <a href="/profile"  className="hover:text-stone-900 transition-colors">身材檔案</a>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
