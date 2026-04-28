'use client'

import { useLanguage, LanguageProvider } from '@/contexts/LanguageContext'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import { Home, Camera, Clock, Sparkles, MoreHorizontal, Search } from 'lucide-react'

// ── 底部 Tab 定義 ────────────────────────────────────────────────────────────
// "更多" tab 涵蓋：/profile /pattern /wardrobe /search
const MORE_PATHS = ['/profile', '/pattern', '/wardrobe', '/search', '/more']

const TABS = [
  { href: '/',               Icon: Home,          labelZh: '首頁', labelEn: 'Home'     },
  { href: '/analyze',        Icon: Camera,        labelZh: '分析', labelEn: 'Analyze'  },
  { href: '/history',        Icon: Clock,         labelZh: '歷史', labelEn: 'History'  },
  { href: '/recommendations',Icon: Sparkles,      labelZh: '建議', labelEn: 'Tips'     },
  { href: '/more',           Icon: MoreHorizontal,labelZh: '更多', labelEn: 'More'     },
] as const

// ── 頂部 Header ──────────────────────────────────────────────────────────────
function TopBar() {
  const { lang, toggle } = useLanguage()

  return (
    <header
      className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-stone-200"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="font-bold text-lg tracking-tight text-stone-800 select-none">
          Chailyn
        </a>

        <div className="flex items-center gap-2">
          {/* 搜尋圖示（手機版頂部快速入口） */}
          <a
            href="/search"
            className="w-10 h-10 flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 transition-colors md:hidden"
            aria-label="搜尋版型"
          >
            <Search size={20} />
          </a>

          {/* 桌機導航連結（md 以上才顯示） */}
          <nav className="hidden md:flex items-center gap-5 text-sm text-stone-600 ml-2">
            <a href="/analyze"         className="hover:text-stone-900 transition-colors">{lang === 'zh' ? '分析照片' : 'Analyze'}</a>
            <a href="/history"         className="hover:text-stone-900 transition-colors">{lang === 'zh' ? '分析歷史' : 'History'}</a>
            <a href="/recommendations" className="hover:text-stone-900 transition-colors font-medium" style={{ color: '#2E5E4E' }}>{lang === 'zh' ? '設計建議' : 'Design Tips'}</a>
            <a href="/search"          className="hover:text-stone-900 transition-colors">{lang === 'zh' ? '搜尋版型' : 'Search'}</a>
            <a href="/pattern"         className="hover:text-stone-900 transition-colors">{lang === 'zh' ? '版型' : 'Pattern'}</a>
            <a href="/wardrobe"        className="hover:text-stone-900 transition-colors">{lang === 'zh' ? '衣櫃' : 'Wardrobe'}</a>
            <a href="/profile"         className="hover:text-stone-900 transition-colors">{lang === 'zh' ? '身材檔案' : 'Profile'}</a>
          </nav>

          {/* 語言切換 */}
          <button
            onClick={toggle}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all select-none"
            style={{
              borderColor: '#2E5E4E',
              color:        lang === 'zh' ? '#fff' : '#2E5E4E',
              background:   lang === 'zh' ? '#2E5E4E' : 'transparent',
            }}
            title={lang === 'zh' ? 'Switch to English' : '切換繁體中文'}
          >
            <span style={{ opacity: lang === 'zh' ? 1 : 0.45 }}>CN</span>
            <span className="text-stone-300 font-light">|</span>
            <span style={{ opacity: lang === 'en' ? 1 : 0.45 }}>EN</span>
          </button>
        </div>
      </div>
    </header>
  )
}

// ── 底部 Tab Bar（手機專用） ─────────────────────────────────────────────────
function BottomTabBar() {
  const { lang } = useLanguage()
  const pathname  = usePathname()

  const isActive = (href: string) => {
    if (href === '/more') return MORE_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (href === '/')    return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-stone-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16">
        {TABS.map(({ href, Icon, labelZh, labelEn }) => {
          const active = isActive(href)
          const label  = lang === 'zh' ? labelZh : labelEn

          return (
            <a
              key={href}
              href={href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:bg-stone-50 ${
                active ? 'text-stone-900' : 'text-stone-400'
              }`}
            >
              <Icon
                size={23}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span className="text-[10px] font-medium leading-none">
                {label}
              </span>
              {/* 底部 active 指示點 */}
              {active && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-stone-800" />
              )}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

// ── AppShell ─────────────────────────────────────────────────────────────────
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 pt-4 has-bottom-tab">
        {children}
      </main>
      <BottomTabBar />
    </LanguageProvider>
  )
}
