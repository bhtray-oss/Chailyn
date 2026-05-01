'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import { Ruler, Shirt, Search, User, ChevronRight, Globe } from 'lucide-react'

interface MenuItem {
  href:    string
  icon:    React.ReactNode
  labelZh: string
  labelEn: string
  descZh:  string
  descEn:  string
}

export default function MorePage() {
  const { lang, toggle } = useLanguage()
  const t = (zh: string, en: string) => lang === 'zh' ? zh : en

  const menuItems: MenuItem[] = [
    {
      href:    '/pattern',
      icon:    <Ruler size={16} strokeWidth={1.5} />,
      labelZh: '版型庫',
      labelEn: 'Pattern Library',
      descZh:  '15 款 FreeSewing 版型，即時打版下載',
      descEn:  '15 FreeSewing patterns, draft & export',
    },
    {
      href:    '/wardrobe',
      icon:    <Shirt size={16} strokeWidth={1.5} />,
      labelZh: '衣櫃',
      labelEn: 'Wardrobe',
      descZh:  '所有已儲存的版型，依款式分組',
      descEn:  'Saved patterns grouped by design',
    },
    {
      href:    '/search',
      icon:    <Search size={16} strokeWidth={1.5} />,
      labelZh: '搜尋版型',
      labelEn: 'Search Patterns',
      descZh:  '用自然語言搜尋 FreeSewing 版型',
      descEn:  'Find patterns by natural language',
    },
    {
      href:    '/profile',
      icon:    <User size={16} strokeWidth={1.5} />,
      labelZh: '身材檔案',
      labelEn: 'Body Profile',
      descZh:  '管理量身數據，支援多版本',
      descEn:  'Manage measurements, multi-profile',
    },
  ]

  return (
    <div className="max-w-lg mx-auto pt-4">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-2">
          {t('功能選單', 'Menu')}
        </p>
        <h1 className="font-display text-3xl text-[var(--ink)]">
          {t('更多', 'More')}
        </h1>
      </div>

      {/* Menu list */}
      <div className="border-t border-[var(--border)]">
        {menuItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 py-4 border-b border-[var(--border)] hover:bg-[var(--gold-light)] transition-colors px-1 group"
          >
            <span className="text-[var(--gold)] flex-shrink-0 w-5 flex justify-center">
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--ink)] tracking-wide">
                {lang === 'zh' ? item.labelZh : item.labelEn}
              </div>
              <div className="text-xs text-[var(--muted)] mt-0.5 truncate">
                {lang === 'zh' ? item.descZh : item.descEn}
              </div>
            </div>
            <ChevronRight size={14} strokeWidth={1.5} className="text-[var(--border)] group-hover:text-[var(--muted)] transition-colors flex-shrink-0" />
          </a>
        ))}
      </div>

      {/* Language */}
      <div className="mt-8 border-t border-[var(--border)] pt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe size={16} strokeWidth={1.5} className="text-[var(--gold)]" />
          <div>
            <div className="text-sm font-medium text-[var(--ink)]">{t('語言設定', 'Language')}</div>
            <div className="text-xs text-[var(--muted)]">{t('目前：繁體中文', 'Current: English')}</div>
          </div>
        </div>
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-[10px] tracking-widest font-medium px-3 py-1.5 uppercase transition-all"
          style={{
            border:     '1px solid var(--gold)',
            color:      lang === 'zh' ? 'var(--surface)' : 'var(--gold)',
            background: lang === 'zh' ? 'var(--gold)'    : 'transparent',
          }}
        >
          <span style={{ opacity: lang === 'zh' ? 1 : 0.5 }}>CN</span>
          <span className="opacity-30">|</span>
          <span style={{ opacity: lang === 'en' ? 1 : 0.5 }}>EN</span>
        </button>
      </div>

      {/* Version */}
      <p className="text-center text-[10px] tracking-widest uppercase text-[var(--muted)] mt-10 pb-2">
        Chailyn v0.1.0 · FreeSewing + Claude AI
      </p>
    </div>
  )
}
