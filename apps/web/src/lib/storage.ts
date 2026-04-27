/**
 * storage.ts — 單機版檔案儲存工具
 * 所有資料存在 ~/.chailyn/standalone/ 目錄下
 */
import fs from 'fs'
import path from 'path'
import os from 'os'

export const BASE_DIR      = path.join(os.homedir(), '.chailyn')
export const UPLOADS_DIR   = path.join(BASE_DIR, 'uploads')
export const JOBS_DIR      = path.join(BASE_DIR, 'standalone', 'jobs')
export const PROFILES_DIR  = path.join(BASE_DIR, 'standalone', 'profiles')
export const PATTERNS_DIR  = path.join(BASE_DIR, 'standalone', 'patterns')

// 確保所有目錄存在
for (const dir of [UPLOADS_DIR, JOBS_DIR, PROFILES_DIR, PATTERNS_DIR]) {
  fs.mkdirSync(dir, { recursive: true })
}

export function readJson<T = unknown>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

export function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function deleteFile(filePath: string): boolean {
  try { fs.unlinkSync(filePath); return true }
  catch { return false }
}

export function listJsonFiles(dir: string): string[] {
  try { return fs.readdirSync(dir).filter(f => f.endsWith('.json')) }
  catch { return [] }
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

export function readBytes(filePath: string): Buffer | null {
  try { return fs.readFileSync(filePath) }
  catch { return null }
}

export function writeBytes(filePath: string, data: Buffer): void {
  fs.writeFileSync(filePath, data)
}

// ─── 預設 dev user & profile ────────────────────────────────────────────────

export const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
export const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

const DEFAULT_MEASUREMENTS_MM: Record<string, number> = {
  chest: 920, waist: 720, hips: 980, highBust: 840,
  neck: 360, hpsToWaistBack: 400, shoulderToShoulder: 400,
  shoulderSlope: 13, biceps: 310, waistToHips: 200,
  inseam: 760, seat: 980, wrist: 160,
  shoulderToWrist: 600, waistToKnee: 380, waistToFloor: 1000,
}

export interface Profile {
  id: string
  user_id: string
  label: string
  version: number
  parent_id: string | null
  measurements: Record<string, number>
  derived_measurements: Record<string, number>
  notes: string | null
  created_at: string
  updated_at: string
}

export function ensureDevProfile(): Profile {
  const profilePath = path.join(PROFILES_DIR, `${DEV_PROFILE_ID}.json`)
  const existing = readJson<Profile>(profilePath)
  if (existing) return existing

  const now = new Date().toISOString()
  const derived: Record<string, number> = {
    halfChest:    DEFAULT_MEASUREMENTS_MM.chest  / 2,
    quarterChest: DEFAULT_MEASUREMENTS_MM.chest  / 4,
    halfWaist:    DEFAULT_MEASUREMENTS_MM.waist  / 2,
    halfHips:     DEFAULT_MEASUREMENTS_MM.hips   / 2,
    bustSpan:     (DEFAULT_MEASUREMENTS_MM.chest - (DEFAULT_MEASUREMENTS_MM.highBust ?? DEFAULT_MEASUREMENTS_MM.chest)) ,
  }

  const profile: Profile = {
    id:                  DEV_PROFILE_ID,
    user_id:             DEV_USER_ID,
    label:               '預設體型',
    version:             1,
    parent_id:           null,
    measurements:        DEFAULT_MEASUREMENTS_MM,
    derived_measurements: derived,
    notes:               null,
    created_at:          now,
    updated_at:          now,
  }
  writeJson(profilePath, profile)

  // 建立 user → profiles 索引
  const indexPath = path.join(PROFILES_DIR, `user-${DEV_USER_ID}.json`)
  writeJson(indexPath, [DEV_PROFILE_ID])

  return profile
}
