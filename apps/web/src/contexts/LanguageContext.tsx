'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Lang } from '@/lib/i18n'
import { createT } from '@/lib/i18n'

interface LanguageCtx {
  lang:   Lang
  toggle: () => void
  t:      ReturnType<typeof createT>
}

const LanguageContext = createContext<LanguageCtx>({
  lang:   'zh',
  toggle: () => {},
  t:      createT('zh'),
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  /**
   * Always start with 'zh' so the client's first render matches the
   * server-rendered HTML — no React hydration mismatch.
   *
   * useEffect fires immediately after hydration and reads the data-lang
   * attribute that the blocking inline <script> in layout.tsx already
   * stamped on <html> *before* the body was parsed.  Because that script
   * runs synchronously in <head>, data-lang is already 'en' by the time
   * React mounts, so the state update happens in the first browser frame
   * and is imperceptible as a flash.
   */
  const [lang, setLang] = useState<Lang>('zh')

  useEffect(() => {
    // data-lang is set by the blocking <script> in layout.tsx
    const attr = document.documentElement.getAttribute('data-lang') as Lang | null
    if (attr === 'en' || attr === 'zh') {
      setLang(attr)
    } else {
      // Fallback: direct localStorage read (covers very first visit)
      try {
        const saved = localStorage.getItem('chailyn-lang') as Lang | null
        if (saved === 'en' || saved === 'zh') setLang(saved)
      } catch { /* ignore */ }
    }
    // Signal CSS that the correct language is now rendered — lifts anti-flash opacity=0
    requestAnimationFrame(() => {
      document.documentElement.classList.add('lang-ready')
    })
  }, [])

  const toggle = () => {
    const next: Lang = lang === 'zh' ? 'en' : 'zh'
    setLang(next)
    try { localStorage.setItem('chailyn-lang', next) } catch { /* ignore */ }
    document.documentElement.setAttribute('data-lang', next)
  }

  return (
    <LanguageContext.Provider value={{ lang, toggle, t: createT(lang) }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
