'use client'

import { useState, FormEvent } from 'react'
import { useRouter }           from 'next/navigation'
import { useAuth }             from '@/contexts/AuthContext'
import { useLanguage }         from '@/contexts/LanguageContext'
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react'

// ── Password strength rules ───────────────────────────────────────────────────

interface Rule { label: string; test: (pw: string) => boolean }

const makeRules = (lang: 'zh' | 'en'): Rule[] => [
  {
    label: lang === 'zh' ? '至少 8 個字元' : 'At least 8 characters',
    test:  pw => pw.length >= 8,
  },
  {
    label: lang === 'zh' ? '包含字母' : 'Contains a letter',
    test:  pw => /[A-Za-z]/.test(pw),
  },
  {
    label: lang === 'zh' ? '包含數字' : 'Contains a number',
    test:  pw => /\d/.test(pw),
  },
]

function strengthLevel(pw: string, rules: Rule[]): 0 | 1 | 2 | 3 {
  const passed = rules.filter(r => r.test(pw)).length
  return passed as 0 | 1 | 2 | 3
}

// ── i18n ──────────────────────────────────────────────────────────────────────

const COPY = {
  zh: {
    title:       '建立帳號',
    subtitle:    '加入 Chailyn AI 打版社群',
    nameLabel:   '暱稱',
    namePh:      '您的名字',
    emailLabel:  '電子信箱',
    emailPh:     'you@example.com',
    passLabel:   '密碼',
    passPh:      '設定密碼',
    strengthLow: '強度：弱',
    strengthMid: '強度：中',
    strengthHigh:'強度：強',
    submit:      '建立帳號',
    loading:     '建立中…',
    hasAccount:  '已有帳號？',
    login:       '前往登入',
    terms:       '建立帳號即代表您同意',
    termsLink:   '服務條款',
    and:         '及',
    privacyLink: '隱私政策',
  },
  en: {
    title:       'Create Account',
    subtitle:    'Join the Chailyn AI pattern community',
    nameLabel:   'Display Name',
    namePh:      'Your name',
    emailLabel:  'Email',
    emailPh:     'you@example.com',
    passLabel:   'Password',
    passPh:      'Create password',
    strengthLow: 'Strength: Weak',
    strengthMid: 'Strength: Fair',
    strengthHigh:'Strength: Strong',
    submit:      'Create Account',
    loading:     'Creating…',
    hasAccount:  'Already have an account?',
    login:       'Sign in',
    terms:       'By creating an account you agree to our',
    termsLink:   'Terms of Service',
    and:         'and',
    privacyLink: 'Privacy Policy',
  },
}

// ── Strength bar colours ──────────────────────────────────────────────────────

const STRENGTH_COLOURS = ['#E5DDD6', '#E57373', '#FFB74D', '#66BB6A']

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const { lang }      = useLanguage()
  const { register }  = useAuth()
  const router        = useRouter()
  const c             = COPY[lang]
  const rules         = makeRules(lang)

  const [displayName, setDisplayName] = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPw,      setShowPw]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)

  const strength = strengthLevel(password, rules)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (strength < 3) {
      setError(lang === 'zh'
        ? '密碼需包含至少 8 個字元、字母與數字'
        : 'Password must be at least 8 chars and include a letter and number')
      return
    }

    setLoading(true)
    try {
      await register(email.trim().toLowerCase(), password, displayName.trim())
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '註冊失敗')
    } finally {
      setLoading(false)
    }
  }

  const strengthLabel = strength === 0
    ? ''
    : strength === 1 ? c.strengthLow
    : strength === 2 ? c.strengthMid
    : c.strengthHigh

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl tracking-[0.18em] uppercase text-[#0C0A09] mb-2">
            Chailyn
          </h1>
          <p className="text-xs tracking-widest uppercase text-[#8C7B72]">
            {c.subtitle}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-none border border-[#E5DDD6] p-8 shadow-sm">

          <h2 className="font-display text-xl tracking-wide text-[#0C0A09] mb-6">
            {c.title}
          </h2>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Display name */}
            <div>
              <label className="block text-[11px] tracking-widest uppercase text-[#8C7B72] mb-1.5">
                {c.nameLabel}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={c.namePh}
                required
                autoComplete="name"
                className="w-full px-3 py-2.5 text-sm border border-[#E5DDD6] bg-[#FAFAF9] focus:outline-none focus:border-[#C9A96E] transition-colors placeholder-[#C4B8B0]"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] tracking-widest uppercase text-[#8C7B72] mb-1.5">
                {c.emailLabel}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={c.emailPh}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 text-sm border border-[#E5DDD6] bg-[#FAFAF9] focus:outline-none focus:border-[#C9A96E] transition-colors placeholder-[#C4B8B0]"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] tracking-widest uppercase text-[#8C7B72] mb-1.5">
                {c.passLabel}
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={c.passPh}
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-[#E5DDD6] bg-[#FAFAF9] focus:outline-none focus:border-[#C9A96E] transition-colors placeholder-[#C4B8B0]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7B72] hover:text-[#0C0A09] transition-colors"
                  aria-label={showPw ? '隱藏密碼' : '顯示密碼'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength bar */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="flex-1 h-1 transition-all duration-300"
                        style={{
                          background: i <= strength ? STRENGTH_COLOURS[strength] : '#E5DDD6',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] tracking-wide" style={{ color: STRENGTH_COLOURS[strength] }}>
                    {strengthLabel}
                  </p>
                </div>
              )}

              {/* Rule checklist */}
              {password.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {rules.map(rule => {
                    const ok = rule.test(password)
                    return (
                      <li key={rule.label} className="flex items-center gap-1.5 text-[11px]"
                        style={{ color: ok ? '#66BB6A' : '#8C7B72' }}
                      >
                        {ok
                          ? <Check size={11} strokeWidth={2.5} />
                          : <X     size={11} strokeWidth={2.5} />
                        }
                        {rule.label}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-[11px] tracking-widest uppercase font-medium transition-all disabled:opacity-50 mt-2"
              style={{ background: 'var(--gold, #C9A96E)', color: '#fff' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> {c.loading}
                </span>
              ) : c.submit}
            </button>

          </form>

          {/* Terms */}
          <p className="text-[10px] text-[#8C7B72] text-center mt-4 leading-relaxed">
            {c.terms}{' '}
            <a href="/terms" className="text-[#C9A96E] hover:underline">{c.termsLink}</a>
            {' '}{c.and}{' '}
            <a href="/privacy" className="text-[#C9A96E] hover:underline">{c.privacyLink}</a>
          </p>

        </div>

        {/* Login link */}
        <p className="text-center mt-6 text-xs text-[#8C7B72]">
          {c.hasAccount}{' '}
          <a href="/auth/login" className="text-[#C9A96E] hover:underline font-medium tracking-wide">
            {c.login}
          </a>
        </p>

      </div>
    </div>
  )
}
