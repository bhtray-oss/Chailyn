import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/Nav'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

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
    <html lang="zh-Hant" className={`${cormorant.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-[#F7F5F2] text-[#0C0A09] antialiased overscroll-none font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
