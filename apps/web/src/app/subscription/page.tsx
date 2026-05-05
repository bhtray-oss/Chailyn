'use client'

/**
 * /subscription — 訂閱方案頁
 * Shows current subscription status + plan comparison.
 * On iOS, purchase is handled by native StoreKit 2 SubscriptionStoreView.
 * On web, this page shows status and links to App Store.
 */

import { useEffect, useState } from 'react'
import { useAuth }             from '@/contexts/AuthContext'
import { useLanguage }         from '@/contexts/LanguageContext'
import { useRouter }           from 'next/navigation'
import { Crown, Check, Sparkles, Loader2, RefreshCw } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubscriptionStatus {
  subscribed:  boolean
  tier:        'free' | 'pro'
  status:      string | null   // active | expired | grace_period | billing_retry | null
  expires_at:  string | null
  product_id:  string | null
}

// ── Plan feature lists ────────────────────────────────────────────────────────

const FREE_FEATURES_ZH = [
  '每月 5 次 AI 服裝分析',
  '3 個語義版型搜尋',
  '基本 Armstrong 公式表',
  'SVG 版型預覽',
]
const FREE_FEATURES_EN = [
  '5 AI garment analyses / month',
  '3 semantic pattern searches',
  'Basic Armstrong formula table',
  'SVG pattern preview',
]

const PRO_FEATURES_ZH = [
  '無限次 AI 服裝分析',
  '無限語義版型搜尋',
  '完整 Armstrong 打版圖樣',
  'SVG + DXF + PDF 全格式下載',
  '版型版本歷史（衣櫃）',
  'BOM 材料清單 AI 估算',
  'Apple Sign In 同步',
  '優先客服支援',
]
const PRO_FEATURES_EN = [
  'Unlimited AI garment analyses',
  'Unlimited semantic pattern searches',
  'Full Armstrong pattern drafting',
  'SVG + DXF + PDF download (all formats)',
  'Pattern version history (Wardrobe)',
  'AI-generated Bill of Materials',
  'Apple Sign In sync',
  'Priority support',
]

// ── Status badge helper ───────────────────────────────────────────────────────

function statusColor(status: string | null): string {
  if (status === 'active')        return '#66BB6A'
  if (status === 'grace_period')  return '#FFB74D'
  if (status === 'billing_retry') return '#FFB74D'
  if (status === 'expired')       return '#EF5350'
  if (status === 'revoked')       return '#EF5350'
  return '#8C7B72'
}

function statusLabel(status: string | null, lang: 'zh' | 'en'): string {
  const map: Record<string, { zh: string; en: string }> = {
    active:        { zh: '訂閱中',     en: 'Active'        },
    grace_period:  { zh: '寬限期中',   en: 'Grace Period'  },
    billing_retry: { zh: '帳單重試中', en: 'Billing Retry' },
    expired:       { zh: '已過期',     en: 'Expired'       },
    revoked:       { zh: '已撤銷',     en: 'Revoked'       },
  }
  if (status && map[status]) return map[status][lang]
  return lang === 'zh' ? '免費方案' : 'Free Plan'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const { user, isLoggedIn, isLoading: authLoading, accessToken } = useAuth()
  const { lang }  = useLanguage()
  const router    = useRouter()

  const [sub,        setSub]        = useState<SubscriptionStatus | null>(null)
  const [subLoading, setSubLoading] = useState(false)
  const [subError,   setSubError]   = useState<string | null>(null)

  const isPro = user?.subscription_tier === 'pro'

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push('/auth/login')
    }
  }, [authLoading, isLoggedIn, router])

  // Fetch subscription status
  const fetchStatus = async () => {
    if (!accessToken) return
    setSubLoading(true)
    setSubError(null)
    try {
      const res = await fetch('/api/subscriptions/status', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSub(data)
      }
    } catch {
      setSubError(lang === 'zh' ? '無法載入訂閱狀態' : 'Failed to load subscription status')
    } finally {
      setSubLoading(false)
    }
  }

  useEffect(() => {
    if (accessToken) fetchStatus()
  }, [accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#C9A96E]" />
      </div>
    )
  }

  const freeFeatures = lang === 'zh' ? FREE_FEATURES_ZH : FREE_FEATURES_EN
  const proFeatures  = lang === 'zh' ? PRO_FEATURES_ZH  : PRO_FEATURES_EN

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">

      {/* Title */}
      <div className="mb-8">
        <h1 className="font-display text-2xl tracking-wide text-[#0C0A09] mb-1">
          {lang === 'zh' ? '訂閱方案' : 'Subscription'}
        </h1>
        <p className="text-xs text-[#8C7B72] tracking-wide">
          {lang === 'zh'
            ? '解鎖 Chailyn 的完整 AI 打版能力'
            : 'Unlock the full power of Chailyn AI pattern drafting'}
        </p>
      </div>

      {/* Current status card */}
      {user && (
        <div className="bg-white border border-[#E5DDD6] p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] tracking-widest uppercase text-[#8C7B72]">
              {lang === 'zh' ? '目前狀態' : 'Current Status'}
            </h2>
            <button
              onClick={fetchStatus}
              disabled={subLoading}
              className="text-[#8C7B72] hover:text-[#0C0A09] transition-colors"
              aria-label={lang === 'zh' ? '重新整理' : 'Refresh'}
            >
              <RefreshCw size={14} className={subLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Plan badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] tracking-widest uppercase font-semibold"
              style={{
                background: isPro ? 'var(--gold, #C9A96E)' : '#E5DDD6',
                color:      isPro ? '#fff' : '#3D3530',
              }}
            >
              {isPro && <Crown size={11} />}
              {isPro
                ? (lang === 'zh' ? 'Pro 方案' : 'Pro Plan')
                : (lang === 'zh' ? '免費方案' : 'Free Plan')}
            </div>

            {/* Status */}
            {sub && (
              <span className="text-xs font-medium" style={{ color: statusColor(sub.status) }}>
                {statusLabel(sub.status, lang)}
              </span>
            )}
          </div>

          {/* Expiry */}
          {sub?.expires_at && (
            <p className="mt-2 text-[11px] text-[#8C7B72]">
              {lang === 'zh' ? '到期日：' : 'Expires: '}
              {new Date(sub.expires_at).toLocaleDateString(
                lang === 'zh' ? 'zh-TW' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )}
            </p>
          )}

          {/* Grace period warning */}
          {sub?.status === 'grace_period' && (
            <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 text-xs text-amber-700">
              {lang === 'zh'
                ? '⚠️ 您的付款失敗，目前處於寬限期。請在寬限期結束前更新付款方式以繼續享有 Pro 功能。'
                : '⚠️ Your payment failed. You are in a grace period. Please update your payment method before it ends to keep Pro access.'}
            </div>
          )}

          {subError && <p className="mt-2 text-xs text-red-500">{subError}</p>}
        </div>
      )}

      {/* Plan comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Free plan */}
        <div className={`bg-white border p-5 ${!isPro ? 'border-[#C9A96E]' : 'border-[#E5DDD6]'}`}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[11px] tracking-widest uppercase font-semibold text-[#3D3530]">
              {lang === 'zh' ? '免費方案' : 'Free'}
            </h3>
            {!isPro && (
              <span className="text-[10px] tracking-widest uppercase text-[#C9A96E] font-semibold">
                {lang === 'zh' ? '目前方案' : 'Current'}
              </span>
            )}
          </div>
          <div className="font-display text-2xl text-[#0C0A09] mb-4">
            {lang === 'zh' ? '免費' : 'Free'}
          </div>
          <ul className="space-y-2">
            {freeFeatures.map(f => (
              <li key={f} className="flex items-start gap-2 text-xs text-[#3D3530]">
                <Check size={12} className="mt-0.5 shrink-0 text-[#8C7B72]" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro plan */}
        <div className={`border p-5 ${isPro ? 'border-[#C9A96E]' : 'border-[#0C0A09]'}`}
          style={{ background: isPro ? '#FFFDF9' : '#0C0A09' }}>

          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[11px] tracking-widest uppercase font-semibold flex items-center gap-1.5"
              style={{ color: isPro ? 'var(--gold, #C9A96E)' : 'var(--gold, #C9A96E)' }}>
              <Crown size={11} /> Pro
            </h3>
            {isPro && (
              <span className="text-[10px] tracking-widest uppercase text-[#C9A96E] font-semibold">
                {lang === 'zh' ? '目前方案' : 'Current'}
              </span>
            )}
          </div>

          <div className="font-display text-2xl mb-0.5" style={{ color: isPro ? '#0C0A09' : '#fff' }}>
            NT$149
          </div>
          <p className="text-[10px] tracking-wide mb-4"
            style={{ color: isPro ? '#8C7B72' : '#8C7B72' }}>
            {lang === 'zh' ? '/ 月，自動續訂' : '/ month, auto-renews'}
          </p>

          <ul className="space-y-2 mb-5">
            {proFeatures.map(f => (
              <li key={f} className="flex items-start gap-2 text-xs"
                style={{ color: isPro ? '#3D3530' : '#D4C9C0' }}>
                <Sparkles size={12} className="mt-0.5 shrink-0"
                  style={{ color: 'var(--gold, #C9A96E)' }} />
                {f}
              </li>
            ))}
          </ul>

          {!isPro && (
            <button
              className="w-full py-2.5 text-[11px] tracking-widest uppercase font-semibold transition-all"
              style={{ background: 'var(--gold, #C9A96E)', color: '#fff' }}
              onClick={() => {
                // On iOS: will open SubscriptionStoreView via native bridge
                // On web: redirect to App Store
                window.open('https://apps.apple.com/app/chailyn/id0000000000', '_blank')
              }}
            >
              {lang === 'zh' ? '升級 Pro — App Store' : 'Upgrade to Pro — App Store'}
            </button>
          )}

          {isPro && (
            <div className="text-[11px] tracking-wide text-center"
              style={{ color: 'var(--gold, #C9A96E)' }}>
              {lang === 'zh'
                ? '✓ 您目前是 Pro 會員，訂閱透過 Apple 管理'
                : '✓ You are a Pro member. Manage via Apple subscriptions.'}
            </div>
          )}
        </div>

      </div>

      {/* Manage subscription note */}
      <p className="mt-6 text-[11px] text-[#8C7B72] text-center leading-relaxed">
        {lang === 'zh'
          ? '訂閱透過 Apple App Store 管理。如需取消，請至 iPhone 設定 → Apple ID → 訂閱。'
          : 'Subscriptions are managed via Apple App Store. To cancel, go to iPhone Settings → Apple ID → Subscriptions.'}
      </p>

    </div>
  )
}
