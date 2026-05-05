import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import './globals.css'
import { AppShell }       from '@/components/Nav'
import { AuthProvider }   from '@/contexts/AuthContext'

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
  // W3C standard equivalent of apple-mobile-web-app-capable (removes browser chrome on Android)
  other: {
    'mobile-web-app-capable': 'yes',
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
    <html lang="zh-Hant" className={`${cormorant.variable} ${dmSans.variable}`}
          suppressHydrationWarning>
      <head>
        {/*
          Blocking script: runs synchronously in <head> before <body> is
          parsed. Stamps data-lang on <html> so LanguageContext's useEffect
          can read it in the very first frame — minimises the visible
          language flash without causing a React hydration mismatch.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var __l=localStorage.getItem('chailyn-lang');document.documentElement.setAttribute('data-lang',(__l==='en'||__l==='zh')?__l:'zh');}catch(e){}` +
            // Safety: if React fails to mount and add lang-ready, un-hide the page after 800ms.
            // This prevents a permanent blank white screen on slow devices or JS errors.
            `setTimeout(function(){document.documentElement.classList.add('lang-ready');},800);`,
          }}
        />
        {/*
          Anti-flash CSS: for EN users, hide body while React re-renders from
          the SSR 'zh' state to 'en'. LanguageContext.useEffect adds 'lang-ready'
          to <html> after the first EN render, which removes the hide rule.

          IMPORTANT: We use :not(.lang-ready) instead of !important so the
          show rule can always override the hide rule — !important on the hide
          rule would permanently block the show rule regardless of specificity.
        */}
        <style dangerouslySetInnerHTML={{
          __html: `html[data-lang="en"]:not(.lang-ready) body{opacity:0}html[data-lang="en"].lang-ready body{opacity:1;transition:opacity 100ms ease}`
        }} />
      </head>
      <body className="min-h-screen bg-[#F7F5F2] text-[#0C0A09] antialiased overscroll-none font-sans"
            suppressHydrationWarning>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
