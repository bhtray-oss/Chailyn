'use client'

import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Home() {
  const { t } = useLanguage()

  const features = [
    { icon: '📸', title: t('home.f1.title'), desc: t('home.f1.desc'), href: '/analyze',  cta: t('home.f1.cta') },
    { icon: '📐', title: t('home.f2.title'), desc: t('home.f2.desc'), href: '/pattern',  cta: t('home.f2.cta') },
    { icon: '👤', title: t('home.f3.title'), desc: t('home.f3.desc'), href: '/profile',  cta: t('home.f3.cta') },
  ]

  const whyItems = [
    { bg: 'bg-amber-100', color: 'text-amber-700', icon: '🎨', title: t('home.engine.title'), desc: t('home.engine.desc') },
    { bg: 'bg-blue-100',  color: 'text-blue-700',  icon: '⚡', title: t('home.ai.title'),     desc: t('home.ai.desc') },
    { bg: 'bg-green-100', color: 'text-green-700', icon: '👗', title: t('home.output.title'), desc: t('home.output.desc') },
  ]

  const stats = [
    { num: '15+',    label: t('home.stat.patterns') },
    { num: '18',     label: t('home.stat.measurements') },
    { num: '< 30 s', label: t('home.stat.time') },
  ]

  return (
    <div className="py-12">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight text-stone-900 mb-4">
          {t('home.hero.title')}
        </h1>
        <p className="text-lg text-stone-500 max-w-xl mx-auto">
          {t('home.hero.desc')}
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/analyze"
            className="px-6 py-3 bg-stone-900 text-white rounded-lg font-medium hover:bg-stone-700 transition-colors"
          >
            {t('home.hero.upload')}
          </Link>
          <Link
            href="/pattern"
            className="px-6 py-3 border border-stone-300 text-stone-700 rounded-lg font-medium hover:bg-stone-100 transition-colors"
          >
            {t('home.hero.browse')}
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((f) => (
          <div
            key={f.href}
            className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-3xl">{f.icon}</div>
            <h2 className="font-semibold text-stone-900 text-lg">{f.title}</h2>
            <p className="text-stone-500 text-sm leading-relaxed flex-1">{f.desc}</p>
            <Link
              href={f.href}
              className="text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
            >
              {f.cta} →
            </Link>
          </div>
        ))}
      </div>

      {/* Why Chailyn */}
      <div className="mt-24 pt-12 border-t border-stone-200">
        <h2 className="text-2xl font-bold text-center mb-12">{t('home.why')}</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          {whyItems.map((w) => (
            <div key={w.title} className="flex flex-col gap-4">
              <div className={`h-10 w-10 ${w.bg} rounded-lg flex items-center justify-center text-xl ${w.color}`}>
                {w.icon}
              </div>
              <h3 className="font-bold text-lg">{w.title}</h3>
              <p className="text-stone-500 text-sm leading-relaxed">{w.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-16 grid grid-cols-3 gap-6 text-center">
        {stats.map((s) => (
          <div key={s.label} className="py-6">
            <div className="text-2xl font-bold text-stone-900">{s.num}</div>
            <div className="text-sm text-stone-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
