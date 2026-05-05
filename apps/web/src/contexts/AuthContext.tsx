'use client'

/**
 * AuthContext
 * ──────────────────────────────────────────────────────────────
 * • Access token stored in memory only (never localStorage/cookie).
 * • Refresh token lives in HttpOnly cookie — managed by Next.js
 *   /api/auth/* proxy routes (invisible to JavaScript).
 * • Auto-refreshes access token 60s before expiry.
 * • Exposes: user, accessToken, login(), register(), logout(), isLoading
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:               string
  email:            string
  display_name:     string
  role:             'user' | 'admin'
  subscription_tier: 'free' | 'pro'
}

interface AuthState {
  user:         AuthUser | null
  accessToken:  string | null
  isLoading:    boolean
  isLoggedIn:   boolean
}

interface AuthActions {
  login:    (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout:   () => Promise<void>
}

type AuthCtx = AuthState & AuthActions

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthCtx>({
  user:        null,
  accessToken: null,
  isLoading:   true,
  isLoggedIn:  false,
  login:       async () => {},
  register:    async () => {},
  logout:      async () => {},
})

// ── Session hint (non-sensitive) ─────────────────────────────────────────────
//
// A plain localStorage flag that records whether this browser has ever
// completed a successful login.  Used ONLY to skip the silent-refresh request
// on mount when we know there is no session — avoids a guaranteed 401 on every
// page load for unauthenticated visitors.
//
// Security note: this flag is NOT trusted for access control.  The real
// authentication check is the HttpOnly refresh-token cookie; this is just a
// UX/noise optimisation.

const SESSION_HINT_KEY = 'chailyn-has-session'

function hasSessionHint(): boolean {
  try { return localStorage.getItem(SESSION_HINT_KEY) === '1' } catch { return false }
}
function setSessionHint()   { try { localStorage.setItem(SESSION_HINT_KEY, '1') } catch { /* ignore */ } }
function clearSessionHint() { try { localStorage.removeItem(SESSION_HINT_KEY) }   catch { /* ignore */ } }

// ── Helper — decode JWT exp (no verify, just read) ────────────────────────────

function jwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]        = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading,   setIsLoading]   = useState(true)

  // Ref for the auto-refresh timer so we can cancel it
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Schedule next silent refresh ─────────────────────────────────────────

  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)

    const exp = jwtExp(token)
    if (!exp) return

    // Refresh 60 seconds before expiry
    const msUntilRefresh = (exp * 1000) - Date.now() - 60_000
    if (msUntilRefresh <= 0) {
      silentRefresh()
      return
    }

    refreshTimer.current = setTimeout(() => silentRefresh(), msUntilRefresh)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Silent token refresh (uses HttpOnly cookie) ───────────────────────────

  const silentRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' })
      if (!res.ok) {
        // Refresh failed → session expired or revoked; clear everything
        setUser(null)
        setAccessToken(null)
        clearSessionHint()
        return null
      }
      const data = await res.json()
      const { access_token, user: freshUser } = data

      setAccessToken(access_token)
      if (freshUser) setUser(freshUser)
      scheduleRefresh(access_token)
      return access_token
    } catch {
      setUser(null)
      setAccessToken(null)
      clearSessionHint()
      return null
    }
  }, [scheduleRefresh])

  // ── Boot: attempt silent refresh on mount ────────────────────────────────
  //
  // Only attempt the refresh if this browser has previously logged in
  // (hasSessionHint). Without the hint we know there is no HttpOnly cookie to
  // exchange, so the request would always return 401 — skipping it keeps the
  // console clean and saves a round-trip for every unauthenticated visitor.

  useEffect(() => {
    if (hasSessionHint()) {
      silentRefresh().finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── login ─────────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail ?? '登入失敗，請確認帳號密碼')
    }

    const data = await res.json()
    setAccessToken(data.access_token)
    setUser(data.user)
    setSessionHint()
    scheduleRefresh(data.access_token)
  }, [scheduleRefresh])

  // ── register ──────────────────────────────────────────────────────────────

  const register = useCallback(async (
    email:       string,
    password:    string,
    displayName: string,
  ) => {
    const res = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, display_name: displayName }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail ?? '註冊失敗，請稍後再試')
    }

    const data = await res.json()
    setAccessToken(data.access_token)
    setUser(data.user)
    setSessionHint()
    scheduleRefresh(data.access_token)
  }, [scheduleRefresh])

  // ── logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)

    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)

    setUser(null)
    setAccessToken(null)
    clearSessionHint()
  }, [])

  // ── Context value ─────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      isLoading,
      isLoggedIn: !!user,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext)
}
