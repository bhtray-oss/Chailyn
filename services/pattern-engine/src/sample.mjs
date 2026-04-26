/**
 * sample.mjs — FreeSewing 取樣功能
 *
 * 支援三種取樣模式（對應 PRD 中的版型比對 / 尺寸對比）：
 *   option      — 同一 design 多組 option 值疊合在一張 SVG 上
 *   measurement — 同一 design 不同 measurement 值疊合
 *   models      — 用 @freesewing/models 的標準尺碼疊合（最適合推薦頁展示）
 */

import { Aaron }   from '@freesewing/aaron'
import { Bella }   from '@freesewing/bella'
import { Bibi }    from '@freesewing/bibi'
import { Brian }   from '@freesewing/brian'
import { Carlita } from '@freesewing/carlita'
import { Carlton } from '@freesewing/carlton'
import { Huey }    from '@freesewing/huey'
import { Lily }    from '@freesewing/lily'
import { Paco }    from '@freesewing/paco'
import { Sandy }   from '@freesewing/sandy'
import { Simon }   from '@freesewing/simon'
import { Simone }  from '@freesewing/simone'
import { Teagan }  from '@freesewing/teagan'
import { Titan }   from '@freesewing/titan'
import { Waralee } from '@freesewing/waralee'
import {
  cisFemaleAdult32, cisFemaleAdult34, cisFemaleAdult36,
  cisFemaleAdult38, cisFemaleAdult40, cisFemaleAdult42,
  cisMaleAdult36, cisMaleAdult38, cisMaleAdult40,
  cisMaleAdult42, cisMaleAdult44,
} from '@freesewing/models'

const DESIGNS = {
  aaron: Aaron, bella: Bella, bibi: Bibi, brian: Brian,
  carlita: Carlita, carlton: Carlton, huey: Huey, lily: Lily,
  paco: Paco, sandy: Sandy, simon: Simon, simone: Simone,
  teagan: Teagan, titan: Titan, waralee: Waralee,
}

// 標準尺碼集（用於 models 模式）
const MODELS_FEMALE = {
  '32': cisFemaleAdult32, '34': cisFemaleAdult34, '36': cisFemaleAdult36,
  '38': cisFemaleAdult38, '40': cisFemaleAdult40, '42': cisFemaleAdult42,
}
const MODELS_MALE = {
  '36': cisMaleAdult36, '38': cisMaleAdult38, '40': cisMaleAdult40,
  '42': cisMaleAdult42, '44': cisMaleAdult44,
}

/**
 * @param {{
 *   design: string,
 *   mode: 'option' | 'measurement' | 'models',
 *   measurements?: Record<string, number>,
 *   sampleOption?: string,
 *   sampleMeasurement?: string,
 *   gender?: 'cisFemale' | 'cisMale',
 *   sa?: number,
 * }} params
 * @returns {{ svg: string, logs: object }}
 */
export async function samplePattern({
  design,
  mode,
  measurements = {},
  sampleOption,
  sampleMeasurement,
  gender = 'cisFemale',
  sa = 0,
}) {
  const Design = DESIGNS[design?.toLowerCase()]
  if (!Design) throw new Error(`Unknown design: "${design}"`)

  const base = new Design({ measurements, sa, complete: false })

  let svg
  if (mode === 'option') {
    if (!sampleOption) throw new Error('sampleOption is required for mode=option')
    svg = base.sampleOption(sampleOption).render()
  } else if (mode === 'measurement') {
    if (!sampleMeasurement) throw new Error('sampleMeasurement is required for mode=measurement')
    svg = base.sampleMeasurement(sampleMeasurement).render()
  } else if (mode === 'models') {
    const models = gender === 'cisMale' ? MODELS_MALE : MODELS_FEMALE
    svg = base.sampleModels(models, gender === 'cisMale' ? '40' : '38').render()
  } else {
    throw new Error(`Unknown sample mode: "${mode}"`)
  }

  return { svg, logs: base.getLogs() }
}
