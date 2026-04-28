'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import {
  User, Ruler, Shirt, Search,
  ChevronRight, Settings,
} from 'lucide-react'

interface MenuItem {
  href:    string
  icon:    React.ReactNode
  labelZh: string
  labelEn: string
  descZh:  string
  descEn:  string
  badge?:  string
}

export default function MorePage() {
  const { lang, toggle } = useLanguage()

  const t = (zh: string, en: string) => lang === 'zh' ? zh : en

  const menuItems: MenuItem[] = [
    {
      href:    '/pattern',
      icon:    <Ruler size={22} className="text-stone-600" />,
      labelZh: '版型庫',
      labelEn: 'Pattern Library',
      descZh:  '瀏覽 15 款 FreeSewing 版型，即時打版下載',
      descEn:  'Browse 15 FreeSewing patterns, draft & export',
    },
    {
      href:    '/wardrobe',
      icon:    <Shirt size={22} className="text-indigo-500" />,
      labelZh: '衣櫃',
      labelEn: 'Wardrobe',
      descZh:  '所有已儲存的版型，依款式分組',
      descEn:  'All saved patterns, grouped by design',
    },
    {
      href:    '/search',
      icon:    <Search size={22} className="text-emerald-600" />,
      labelZh: '搜尋版型',
      labelEn: 'Search Patterns',
      descZh:  '用自然語言搜尋適合的 FreeSewing 版型',
      descEn:  'Find FreeSewing patterns by description',
    },
    {
      href:    '/profile',
      icon:    <User size={22} className="text-stone-500" />,
      labelZh: '身材檔案',
      labelEn: 'Body Profile',
      descZh:  '管理量身數據，支援多版本',
      descEn:  'Manage measurements, multi-profile',
    },
  ]

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">
          {t('更多功能', 'More')}
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          {t('歷史記錄、設計建議與進階工具', 'History, design tips & advanced tools')}
        </p>
      </div>

      {/* Menu list */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-100">
        {menuItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 px-4 py-4 hover:bg-stone-50 active:bg-stone-100 transition-colors"
          >
            {/* Icon */}
            <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
              {item.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-stone-800 text-sm">
                {lang === 'zh' ? item.labelZh : item.labelEn}
              </div>
              <div className="text-xs text-stone-400 mt-0.5 truncate">
                {lang === 'zh' ? item.descZh : item.descEn}
              </div>
            </div>

            {/* Chevron */}
            <ChevronRight size={16} className="text-stone-300 flex-shrink-0" />
          </a>
        ))}
      </div>

      {/* Language toggle */}
      <div className="mt-6 bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
            <Settings size={20} className="text-stone-500" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-stone-800 text-sm">
              {t('語言設定', 'Language')}
            </div>
            <div className="text-xs text-stone-400 mt-0.5">
              {t('目前：繁體中文', 'Current: English')}
            </div>
          </div>
          <button
            onClick={toggle}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all"
            style={{
              borderColor: '#2E5E4E',
              color:        lang === 'zh' ? '#fff' : '#2E5E4E',
              background:   lang === 'zh' ? '#2E5E4E' : 'transparent',
            }}
          >
            <span style={{ opacity: lang === 'zh' ? 1 : 0.45 }}>CN</span>
            <span className="text-stone-300 font-light mx-0.5">|</span>
            <span style={{ opacity: lang === 'en' ? 1 : 0.45 }}>EN</span>
          </button>
        </div>
      </div>

      {/* App version */}
      <p className="text-center text-xs text-stone-300 mt-8 pb-2">
        Chailyn v0.1.0 · Powered by FreeSewing + Claude AI
      </p>
    </div>
  )
}
