'use client'

import { useLanguage, LanguageProvider } from '@/contexts/LanguageContext'
import { useAuth }     from '@/contexts/AuthContext'
import { usePathname } from 'next/navigation'
import { useRouter }   from 'next/navigation'
import { ReactNode, useState, useRef, useEffect } from 'react'
import { Home, Camera, Clock, Sparkles, MoreHorizontal, Search, LogIn, LogOut, User, Crown } from 'lucide-react'

// ── 底部 Tab 定義 ────────────────────────────────────────────────────────────
const MORE_PATHS = ['/profile', '/pattern', '/wardrobe', '/search', '/more']

const TABS = [
  { href: '/',               Icon: Home,          labelZh: '首頁', labelEn: 'Home'    },
  { href: '/analyze',        Icon: Camera,        labelZh: '分析', labelEn: 'Analyze' },
  { href: '/history',        Icon: Clock,         labelZh: '歷史', labelEn: 'History' },
  { href: '/recommendations',Icon: Sparkles,      labelZh: '建議', labelEn: 'Tips'    },
  { href: '/more',           Icon: MoreHorizontal,labelZh: '更多', labelEn: 'More'    },
] as const

// ── User Menu (TopBar) ────────────────────────────────────────────────────────
function UserMenu() {
  const { user, isLoggedIn, isLoading, logout } = useAuth()
  const { lang }  = useLanguage()
  const router    = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef   = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-[#E5DDD6] animate-pulse" />
  }

  if (!isLoggedIn) {
    return (
      <a
        href="/auth/login"
        className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase font-medium px-3 py-1.5 border transition-all"
        style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
      >
        <LogIn size={12} strokeWidth={2} />
        {lang === 'zh' ? '登入' : 'Sign In'}
      </a>
    )
  }

  const initials = (user?.display_name ?? user?.email ?? 'U')
    .slice(0, 2).toUpperCase()
  const isPro = user?.subscription_tier === 'pro'

  return (
    <div ref={menuRef} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-8 h-8 text-[11px] font-semibold tracking-wide select-none transition-opacity hover:opacity-80"
        style={{
          background: isPro ? 'var(--gold, #C9A96E)' : '#E5DDD6',
          color:      isPro ? '#fff' : '#3D3530',
          borderRadius: 0,
        }}
        aria-label="使用者選單"
      >
        {initials}
        {/* Pro crown badge */}
        {isPro && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center bg-[#0C0A09]">
            <Crown size={8} color="var(--gold, #C9A96E)" />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#E5DDD6] shadow-lg z-50 py-1"
          onClick={() => setOpen(false)}
        >
          {/* User info row */}
          <div className="px-3 py-2 border-b border-[#E5DDD6]">
            <p className="text-xs font-medium text-[#0C0A09] truncate">{user?.display_name}</p>
            <p className="text-[10px] text-[#8C7B72] truncate">{user?.email}</p>
            {isPro && (
              <span className="inline-flex items-center gap-1 mt-1 text-[9px] tracking-widest uppercase font-semibold"
                style={{ color: 'var(--gold, #C9A96E)' }}>
                <Crown size={9} /> Pro
              </span>
            )}
          </div>

          {/* Menu items */}
          <a href="/profile"
            className="flex items-center gap-2 px-3 py-2 text-xs text-[#3D3530] hover:bg-[#F7F5F2] transition-colors">
            <User size={13} /> {lang === 'zh' ? '身材管理' : 'My Profile'}
          </a>
          <a href="/subscription"
            className="flex items-center gap-2 px-3 py-2 text-xs text-[#3D3530] hover:bg-[#F7F5F2] transition-colors">
            <Crown size={13} /> {lang === 'zh' ? '訂閱方案' : 'Subscription'}
          </a>

          <div className="border-t border-[#E5DDD6] mt-1 pt-1">
            <button
              onClick={async () => { await logout(); router.push('/') }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#8C7B72] hover:text-[#0C0A09] hover:bg-[#F7F5F2] transition-colors"
            >
              <LogOut size={13} /> {lang === 'zh' ? '登出' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

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
          <nav className="hidden md:flex items-center gap-6 text-xs tracking-widest uppercase font-semibold text-[#8C7B72] ml-4">
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

          {/* 使用者選單 */}
          <UserMenu />
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
                style={{ fontFamily: 'var(--font-body)', fontWeight: active ? 700 : 600 }}
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
