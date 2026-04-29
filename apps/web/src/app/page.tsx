'use client'

import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import { Camera, Scissors, Ruler, Sparkles, Scan, Layers } from 'lucide-react'

export default function Home() {
  const { t, lang } = useLanguage()

  const features = [
    {
      icon: <Camera size={20} strokeWidth={1.5} />,
      title: t('home.f1.title'),
      desc:  t('home.f1.desc'),
      href:  '/analyze',
      cta:   t('home.f1.cta'),
    },
    {
      icon: <Scissors size={20} strokeWidth={1.5} />,
      title: t('home.f2.title'),
      desc:  t('home.f2.desc'),
      href:  '/pattern',
      cta:   t('home.f2.cta'),
    },
    {
      icon: <Ruler size={20} strokeWidth={1.5} />,
      title: t('home.f3.title'),
      desc:  t('home.f3.desc'),
      href:  '/profile',
      cta:   t('home.f3.cta'),
    },
  ]

  const whyItems = [
    { icon: <Layers   size={18} strokeWidth={1.5} />, title: t('home.engine.title'), desc: t('home.engine.desc') },
    { icon: <Scan     size={18} strokeWidth={1.5} />, title: t('home.ai.title'),     desc: t('home.ai.desc')     },
    { icon: <Scissors size={18} strokeWidth={1.5} />, title: t('home.output.title'), desc: t('home.output.desc') },
  ]

  const stats = [
    { num: '15+',    label: t('home.stat.patterns') },
    { num: '18',     label: t('home.stat.measurements') },
    { num: '< 30s',  label: t('home.stat.time') },
  ]

  return (
    <div className="pt-8 pb-4">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="text-center mb-16 px-2">
        {/* 細金線裝飾 */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="h-px w-10 bg-[var(--border)]" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)]">
            {lang === 'zh' ? 'AI × 時尚設計' : 'AI × Fashion Design'}
          </span>
          <span className="h-px w-10 bg-[var(--border)]" />
        </div>

        {/* 主標題 — Cormorant Garamond */}
        <h1 className="font-display text-4xl md:text-5xl text-[var(--ink)] mb-5 leading-tight">
          {lang === 'zh'
            ? <>服裝分析<br /><span style={{ color: 'var(--gold)' }}>×</span> 個人化打版</>
            : <>Garment Analysis<br /><span style={{ color: 'var(--gold)' }}>×</span> Personal Patterns</>
          }
        </h1>

        <p className="text-sm text-[var(--muted)] max-w-sm mx-auto leading-relaxed">
          {t('home.hero.desc')}
        </p>

        {/* CTA 按鈕 */}
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/analyze"
            className="px-6 py-2.5 text-sm tracking-widest uppercase font-medium text-white transition-opacity hover:opacity-80"
            style={{ background: 'var(--ink)' }}
          >
            {lang === 'zh' ? '上傳照片' : 'Upload'}
          </Link>
          <Link
            href="/pattern"
            className="px-6 py-2.5 text-sm tracking-widest uppercase font-medium transition-colors hover:bg-[var(--gold-light)]"
            style={{ border: '1px solid var(--border)', color: 'var(--ink-soft)' }}
          >
            {lang === 'zh' ? '版型庫' : 'Patterns'}
          </Link>
        </div>
      </div>

      {/* ── Feature Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)]">
        {features.map((f) => (
          <div
            key={f.href}
            className="bg-[var(--surface)] p-6 flex flex-col gap-4 group hover:bg-[var(--gold-light)] transition-colors"
          >
            <div className="text-[var(--gold)]">{f.icon}</div>
            <div>
              <h2 className="font-medium text-[var(--ink)] text-sm tracking-wide mb-2">{f.title}</h2>
              <p className="text-[var(--muted)] text-xs leading-relaxed">{f.desc}</p>
            </div>
            <Link
              href={f.href}
              className="mt-auto text-xs tracking-widest uppercase text-[var(--gold)] hover:opacity-70 transition-opacity"
            >
              {f.cta} →
            </Link>
          </div>
        ))}
      </div>

      {/* ── Why Chailyn ───────────────────────────────────────────────── */}
      <div className="mt-20 pt-10 border-t border-[var(--border)]">
        <div className="text-center mb-10">
          <span className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)]">
            {t('home.why')}
          </span>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {whyItems.map((w, i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="text-[var(--gold)]">{w.icon}</div>
              <div className="h-px w-6 bg-[var(--border)]" />
              <h3 className="text-sm font-medium text-[var(--ink)]">{w.title}</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">{w.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div className="mt-16 grid grid-cols-3 border-t border-[var(--border)]">
        {stats.map((s, i) => (
          <div
            key={i}
            className={`py-8 text-center ${i < 2 ? 'border-r border-[var(--border)]' : ''}`}
          >
            <div className="font-display text-3xl text-[var(--ink)]">{s.num}</div>
            <div className="text-[10px] tracking-widest uppercase text-[var(--muted)] mt-2">{s.label}</div>
          </div>
        ))}
      </div>

    </div>
  )
}
