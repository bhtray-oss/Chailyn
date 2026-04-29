'use client'

import { useLanguage, LanguageProvider } from '@/contexts/LanguageContext'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import { Home, Camera, Clock, Sparkles, MoreHorizontal, Search } from 'lucide-react'

// ── 底部 Tab 定義 ────────────────────────────────────────────────────────────
const MORE_PATHS = ['/profile', '/pattern', '/wardrobe', '/search', '/more']

const TABS = [
  { href: '/',               Icon: Home,          labelZh: '首頁', labelEn: 'Home'    },
  { href: '/analyze',        Icon: Camera,        labelZh: '分析', labelEn: 'Analyze' },
  { href: '/history',        Icon: Clock,         labelZh: '歷史', labelEn: 'History' },
  { href: '/recommendations',Icon: Sparkles,      labelZh: '建議', labelEn: 'Tips'    },
  { href: '/more',           Icon: MoreHorizontal,labelZh: '更多', labelEn: 'More'    },
] as const

// ── 頂部 Header ──────────────────────────────────────────────────────────────
function TopBar() {
  const { lang, toggle } = useLanguage()

  return (
    <header
      className="sticky top-0 z-50 bg-[#F7F5F2]/95 backdrop-blur-md border-b border-[#E5DDD6]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        {/* Logo — Cormorant Garamond 優雅 serif */}
        <a
          href="/"
          className="font-display text-xl tracking-[0.18em] text-[#0C0A09] select-none uppercase"
        >
          Chailyn
        </a>

        <div className="flex items-center gap-3">
          {/* 搜尋（手機） */}
          <a
            href="/search"
            className="w-9 h-9 flex items-center justify-center text-[#3D3530] hover:text-[#0C0A09] transition-colors md:hidden"
            aria-label="搜尋版型"
          >
            <Search size={18} strokeWidth={1.5} />
          </a>

          {/* 桌機導航 */}
          <nav className="hidden md:flex items-center gap-6 text-xs tracking-widest uppercase text-[#8C7B72] ml-4">
            <a href="/analyze"         className="hover:text-[#0C0A09] transition-colors">{lang === 'zh' ? '分析' : 'Analyze'}</a>
            <a href="/history"         className="hover:text-[#0C0A09] transition-colors">{lang === 'zh' ? '歷史' : 'History'}</a>
            <a href="/recommendations" className="hover:text-[#0C0A09] transition-colors" style={{ color: 'var(--gold)' }}>{lang === 'zh' ? '建議' : 'Tips'}</a>
            <a href="/search"          className="hover:text-[#0C0A09] transition-colors">{lang === 'zh' ? '搜尋' : 'Search'}</a>
            <a href="/pattern"         className="hover:text-[#0C0A09] transition-colors">{lang === 'zh' ? '版型' : 'Pattern'}</a>
            <a href="/wardrobe"        className="hover:text-[#0C0A09] transition-colors">{lang === 'zh' ? '衣櫃' : 'Wardrobe'}</a>
            <a href="/profile"         className="hover:text-[#0C0A09] transition-colors">{lang === 'zh' ? '身材' : 'Profile'}</a>
          </nav>

          {/* 語言切換 — 極簡文字版 */}
          <button
            onClick={toggle}
            className="flex items-center gap-1 text-[10px] tracking-widest font-medium px-2.5 py-1 rounded-none border border-[#E5DDD6] transition-all select-none uppercase"
            style={{
              color:      lang === 'zh' ? 'var(--surface)' : 'var(--gold)',
              background: lang === 'zh' ? 'var(--gold)'    : 'transparent',
              borderColor:'var(--gold)',
            }}
            title={lang === 'zh' ? 'Switch to English' : '切換繁體中文'}
          >
            <span style={{ opacity: lang === 'zh' ? 1 : 0.5 }}>CN</span>
            <span className="opacity-30 font-light">|</span>
            <span style={{ opacity: lang === 'en' ? 1 : 0.5 }}>EN</span>
          </button>
        </div>
      </div>
    </header>
  )
}

// ── 底部 Tab Bar（手機專用）— 時尚感極簡 ────────────────────────────────────
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#F7F5F2]/97 backdrop-blur-md border-t border-[#E5DDD6]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-[60px]">
        {TABS.map(({ href, Icon, labelZh, labelEn }) => {
          const active = isActive(href)
          const label  = lang === 'zh' ? labelZh : labelEn

          return (
            <a
              key={href}
              href={href}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
              style={{ color: active ? 'var(--ink)' : 'var(--muted)' }}
            >
              {/* 頂部金線 active 指示 */}
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[1.5px]"
                  style={{ background: 'var(--gold)' }}
                />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2 : 1.5}
              />
              <span
                className="text-[9px] tracking-wider uppercase"
                style={{ fontFamily: 'var(--font-body)', fontWeight: active ? 600 : 400 }}
              >
                {label}
              </span>
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
