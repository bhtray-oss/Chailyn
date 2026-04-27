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
  const [lang, setLang] = useState<Lang>('zh')

  useEffect(() => {
    const saved = localStorage.getItem('chailyn-lang') as Lang | null
    if (saved === 'en' || saved === 'zh') setLang(saved)
  }, [])

  const toggle = () => {
    const next: Lang = lang === 'zh' ? 'en' : 'zh'
    setLang(next)
    localStorage.setItem('chailyn-lang', next)
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
