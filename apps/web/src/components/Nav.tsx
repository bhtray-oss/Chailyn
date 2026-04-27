'use client'

import { useLanguage, LanguageProvider } from '@/contexts/LanguageContext'
import { ReactNode } from 'react'

function NavInner() {
  const { lang, toggle, t } = useLanguage()

  return (
    <nav className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="font-bold text-lg tracking-tight text-stone-800">
          Chailyn
        </a>
        <div className="flex items-center gap-5 text-sm text-stone-600">
          <a href="/analyze"          className="hover:text-stone-900 transition-colors">{t('nav.analyze')}</a>
          <a href="/history"          className="hover:text-stone-900 transition-colors">{t('nav.history')}</a>
          <a href="/recommendations"  className="hover:text-stone-900 transition-colors font-medium" style={{ color: '#2E5E4E' }}>{t('nav.recommendations')}</a>
          <a href="/search"           className="hover:text-stone-900 transition-colors">{t('nav.search')}</a>
          <a href="/pattern"          className="hover:text-stone-900 transition-colors">{t('nav.pattern')}</a>
          <a href="/wardrobe"         className="hover:text-stone-900 transition-colors">{t('nav.wardrobe')}</a>
          <a href="/profile"          className="hover:text-stone-900 transition-colors">{t('nav.profile')}</a>

          {/* Language toggle */}
          <button
            onClick={toggle}
            className="ml-2 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all"
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
    </nav>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <NavInner />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </LanguageProvider>
  )
}
