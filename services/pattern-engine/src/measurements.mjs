/**
 * measurements.mjs — FreeSewing 身材資料工具
 *
 * 職責：
 * 1. 把前端 cm/inch 輸入轉成 FreeSewing 要求的 mm 單位
 * 2. 用 @freesewing/models neckstimate() 補齊缺漏欄位
 * 3. 驗證必填 measurements
 */

import { cisFemaleAdult38, cisMaleAdult38 } from '@freesewing/models'

// FreeSewing 所有 standard measurement key 名稱
export const FS_MEASUREMENT_KEYS = [
  'chest', 'waist', 'hips', 'neck', 'seat',
  'hpsToWaistBack', 'hpsToWaistFront',
  'shoulderToWrist', 'shoulderSlope', 'shoulderWidth',
  'highBust', 'bustFront', 'bustPointToUnderbust',
  'underbust', 'biceps', 'wrist',
  'crotchDepth', 'inseam', 'heel', 'ankle',
  'knee', 'upperLeg', 'headCircumference',
  'neckCorsetLength', 'naturalWaist', 'naturalWaistToHip',
  'waistToKnee', 'waistToUpperLeg', 'waistToFloor',
  'waistBack', 'crossChest', 'crossBack',
]

/**
 * 將使用者輸入（cm 或 inch）轉為 mm
 * @param {Record<string, number>} input  - 使用者輸入的 measurements
 * @param {'cm' | 'inch'} units
 * @returns {Record<string, number>}  - mm 單位的 measurements
 */
export function toMm(input, units = 'cm') {
  const factor = units === 'inch' ? 25.4 : 10
  const result = {}
  for (const [key, val] of Object.entries(input)) {
    if (typeof val === 'number' && val > 0) {
      result[key] = Math.round(val * factor)
    }
  }
  return result
}

/**
 * 用 neckstimate 補全缺少的 measurements
 * @param {Record<string, number>} measurements  - 已有的 mm 測量值
 * @param {'cisFemale' | 'cisMale'} gender
 * @returns {Record<string, number>}
 */
export function fillMissingWithNeckstimate(measurements, gender = 'cisFemale') {
  // 選一個性別基礎模板
  const base = gender === 'cisMale'
    ? { ...cisMaleAdult38 }
    : { ...cisFemaleAdult38 }

  const filled = { ...base }

  // 使用者實際提供的值蓋掉模板
  for (const [key, val] of Object.entries(measurements)) {
    if (typeof val === 'number' && val > 0) {
      filled[key] = val
    }
  }

  return filled
}

/**
 * 驗證特定 design 所需的 required measurements 是否存在
 * @param {Record<string, number>} measurements
 * @param {string[]} required
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateMeasurements(measurements, required = []) {
  const missing = required.filter(
    key => !(key in measurements) || measurements[key] <= 0
  )
  return { valid: missing.length === 0, missing }
}
