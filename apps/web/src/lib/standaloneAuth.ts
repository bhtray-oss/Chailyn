/**
 * standaloneAuth.ts
 * ──────────────────────────────────────────────────────────────────
 * Local filesystem authentication for standalone mode (no FastAPI).
 *
 * Storage layout (~/.chailyn/standalone/users/):
 *   auth-secret.json          — 256-bit HMAC signing key (auto-created)
 *   email-index.json          — { "email@..." : "userId" }
 *   {userId}.json             — StandaloneUser record
 *
 * Tokens:
 *   Access  — HS256 JWT, 15-minute TTL, payload: sub/email/role/tier/display_name
 *   Refresh — HS256 JWT, 30-day TTL,   payload: sub/jti
 *   Refresh tokens are NOT stored server-side; validity = signature + expiry.
 */

import crypto from 'crypto'
import path   from 'path'
import { USERS_DIR, readJson, writeJson } from '@/lib/storage'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StandaloneUser {
  id:               string
  email:            string
  display_name:     string
  role:             'user' | 'admin'
  subscription_tier: 'free' | 'pro'
  password_hash:    string    // hex  (pbkdf2 sha256)
  password_salt:    string    // hex
  created_at:       string
}

export interface AuthUserPublic {
  id:               string
  email:            string
  display_name:     string
  role:             'user' | 'admin'
  subscription_tier: 'free' | 'pro'
}

// ── HMAC secret ───────────────────────────────────────────────────────────────

const SECRET_FILE = path.join(USERS_DIR, 'auth-secret.json')

function getSecret(): Buffer {
  const stored = readJson<{ secret: string }>(SECRET_FILE)
  if (stored?.secret) return Buffer.from(stored.secret, 'hex')
  const secret = crypto.randomBytes(32).toString('hex')
  writeJson(SECRET_FILE, { secret })
  return Buffer.from(secret, 'hex')
}

// ── Minimal JWT (no external deps) ───────────────────────────────────────────

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf
  return b.toString('base64url')
}

function parseB64url(s: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(s, 'base64url').toString())
}

export function signJwt(payload: Record<string, unknown>, expiresInSeconds: number): string {
  const now = Math.floor(Date.now() / 1000)
  const full = { ...payload, iat: now, exp: now + expiresInSeconds }
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body    = b64url(JSON.stringify(full))
  const sig     = crypto
    .createHmac('sha256', getSecret())
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${sig}`
}

export interface JwtPayload {
  sub:               string
  email?:            string
  role?:             string
  subscription_tier?: string
  display_name?:     string
  jti?:              string
  iat:               number
  exp:               number
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const [header, body, sig] = token.split('.')
    const expected = crypto
      .createHmac('sha256', getSecret())
      .update(`${header}.${body}`)
      .digest('base64url')
    if (sig !== expected) return null
    const payload = parseB64url(body) as unknown as JwtPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ── Password hashing (PBKDF2 / SHA-256) ──────────────────────────────────────

export function hashPassword(password: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
  return { hash: hash.toString('hex'), salt: salt.toString('hex') }
}

function verifyPassword(password: string, storedHash: string, saltHex: string): boolean {
  const { hash } = hashPassword(password, saltHex)
  // Constant-time compare
  try { return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex')) }
  catch { return false }
}

// ── User CRUD ─────────────────────────────────────────────────────────────────

const emailIndex = (): Record<string, string> =>
  readJson<Record<string, string>>(path.join(USERS_DIR, 'email-index.json')) ?? {}

function saveEmailIndex(idx: Record<string, string>) {
  writeJson(path.join(USERS_DIR, 'email-index.json'), idx)
}

export function findUserByEmail(email: string): StandaloneUser | null {
  const idx = emailIndex()
  const uid = idx[email.toLowerCase()]
  if (!uid) return null
  return readJson<StandaloneUser>(path.join(USERS_DIR, `${uid}.json`))
}

export function findUserById(id: string): StandaloneUser | null {
  return readJson<StandaloneUser>(path.join(USERS_DIR, `${id}.json`))
}

export function createUser(
  email:       string,
  password:    string,
  displayName: string,
): StandaloneUser {
  const existing = findUserByEmail(email)
  if (existing) throw new Error('Email already registered')

  const { hash, salt } = hashPassword(password)
  const user: StandaloneUser = {
    id:               crypto.randomUUID(),
    email:            email.toLowerCase(),
    display_name:     displayName,
    role:             'user',
    subscription_tier: 'free',
    password_hash:    hash,
    password_salt:    salt,
    created_at:       new Date().toISOString(),
  }

  writeJson(path.join(USERS_DIR, `${user.id}.json`), user)

  const idx = emailIndex()
  idx[user.email] = user.id
  saveEmailIndex(idx)

  return user
}

// ── Auth tokens ───────────────────────────────────────────────────────────────

const ACCESS_TTL  = 15 * 60          //  15 minutes
const REFRESH_TTL = 30 * 24 * 60 * 60  //  30 days

function publicUser(u: StandaloneUser): AuthUserPublic {
  return { id: u.id, email: u.email, display_name: u.display_name,
           role: u.role, subscription_tier: u.subscription_tier }
}

export function issueTokens(user: StandaloneUser) {
  const access_token = signJwt(
    { sub: user.id, email: user.email, role: user.role,
      subscription_tier: user.subscription_tier, display_name: user.display_name },
    ACCESS_TTL,
  )
  const refresh_token = signJwt(
    { sub: user.id, jti: crypto.randomUUID() },
    REFRESH_TTL,
  )
  return { access_token, refresh_token, user: publicUser(user) }
}

// ── validate login (email + password) ────────────────────────────────────────

export function validateCredentials(email: string, password: string): StandaloneUser | null {
  const user = findUserByEmail(email)
  if (!user) return null
  if (!verifyPassword(password, user.password_hash, user.password_salt)) return null
  return user
}

// ── refresh token → new tokens ───────────────────────────────────────────────

export function refreshTokens(refreshToken: string): ReturnType<typeof issueTokens> | null {
  const payload = verifyJwt(refreshToken)
  if (!payload?.sub) return null
  const user = findUserById(payload.sub)
  if (!user) return null
  return issueTokens(user)
}
