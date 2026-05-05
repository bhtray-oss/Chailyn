'use client'

import { useState, FormEvent } from 'react'
import { useRouter }           from 'next/navigation'
import { useAuth }             from '@/contexts/AuthContext'
import { useLanguage }         from '@/contexts/LanguageContext'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

// ── i18n strings ──────────────────────────────────────────────────────────────
const COPY = {
  zh: {
    title:       '登入 Chailyn',
    subtitle:    '繼續您的 AI 打版旅程',
    emailLabel:  '電子信箱',
    emailPh:     'you@example.com',
    passLabel:   '密碼',
    passPh:      '輸入密碼',
    submit:      '登入',
    loading:     '登入中…',
    noAccount:   '還沒有帳號？',
    register:    '立即註冊',
    forgotPass:  '忘記密碼？',
    appleBtn:    '使用 Apple 登入',
    orDivider:   '或',
  },
  en: {
    title:       'Sign In to Chailyn',
    subtitle:    'Continue your AI pattern-making journey',
    emailLabel:  'Email',
    emailPh:     'you@example.com',
    passLabel:   'Password',
    passPh:      'Enter password',
    submit:      'Sign In',
    loading:     'Signing in…',
    noAccount:   "Don't have an account?",
    register:    'Create account',
    forgotPass:  'Forgot password?',
    appleBtn:    'Sign in with Apple',
    orDivider:   'or',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { lang }   = useLanguage()
  const { login }  = useAuth()
  const router     = useRouter()
  const c          = COPY[lang]

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(email.trim().toLowerCase(), password)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
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

          {/* Error banner */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] tracking-widest uppercase text-[#8C7B72]">
                  {c.passLabel}
                </label>
                <button
                  type="button"
                  className="text-[11px] text-[#C9A96E] hover:underline tracking-wide"
                >
                  {c.forgotPass}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={c.passPh}
                  required
                  autoComplete="current-password"
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
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-[11px] tracking-widest uppercase font-medium transition-all disabled:opacity-50"
              style={{
                background: 'var(--gold, #C9A96E)',
                color:      '#fff',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> {c.loading}
                </span>
              ) : c.submit}
            </button>

          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E5DDD6]" />
            <span className="text-[11px] tracking-widest text-[#C4B8B0] uppercase">{c.orDivider}</span>
            <div className="flex-1 h-px bg-[#E5DDD6]" />
          </div>

          {/* Apple Sign In */}
          <button
            type="button"
            className="w-full py-3 flex items-center justify-center gap-2 text-[11px] tracking-widest uppercase font-medium border border-[#0C0A09] text-[#0C0A09] hover:bg-[#0C0A09] hover:text-white transition-all"
            onClick={() => {
              // Apple Sign In — handled by iOS native; on web redirect to Apple OAuth
              alert('Apple 登入即將開放')
            }}
          >
            {/* Apple logo SVG */}
            <svg width="14" height="14" viewBox="0 0 814 1000" fill="currentColor">
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-37.8-155.5-127.7C46.7 790 0 663.3 0 541.8c0-243.9 143.2-372.5 283.6-372.5 75.7 0 138.6 43.6 185.7 43.6 44.9 0 115.9-46.2 199.9-46.2l36.8.4zm-246.8-161.3c35.4-42.1 59.8-101.2 59.8-160.3 0-8.3-.6-16.7-2-24.4-56.8 2.1-124.4 37.8-164.7 85.1-31.5 36.4-60.3 95.4-60.3 155.4 0 9 1.4 18 2 20.9 3.8.6 9.7 1.4 15.6 1.4 50.9 0 114.4-33.9 149.6-78.1z"/>
            </svg>
            {c.appleBtn}
          </button>

        </div>

        {/* Register link */}
        <p className="text-center mt-6 text-xs text-[#8C7B72]">
          {c.noAccount}{' '}
          <a
            href="/auth/register"
            className="text-[#C9A96E] hover:underline font-medium tracking-wide"
          >
            {c.register}
          </a>
        </p>

      </div>
    </div>
  )
}
