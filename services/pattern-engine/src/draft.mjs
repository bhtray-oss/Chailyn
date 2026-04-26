/**
 * draft.mjs — FreeSewing 打版核心
 *
 * 輸入:  { design, measurements (mm), options, settings }
 * 輸出:  { svg, renderProps, logs }
 *
 * 支援的 design:
 *   aaron, bella, bibi, brian, carlita, carlton,
 *   huey, lily, paco, sandy, simon, simone,
 *   teagan, titan, waralee
 */

import { themePlugin } from '@freesewing/plugin-theme'
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

/** Map design id → constructor */
const DESIGNS = {
  aaron:   Aaron,
  bella:   Bella,
  bibi:    Bibi,
  brian:   Brian,
  carlita: Carlita,
  carlton: Carlton,
  huey:    Huey,
  lily:    Lily,
  paco:    Paco,
  sandy:   Sandy,
  simon:   Simon,
  simone:  Simone,
  teagan:  Teagan,
  titan:   Titan,
  waralee: Waralee,
}

/**
 * 打版並回傳 SVG 字串 + logs
 *
 * @param {{
 *   design: string,
 *   measurements: Record<string, number>,
 *   options?: Record<string, unknown>,
 *   sa?: number,
 *   paperless?: boolean,
 *   units?: 'metric' | 'imperial',
 *   renderMode?: 'svg' | 'props'
 * }} params
 * @returns {{ svg?: string, renderProps?: object, logs: object }}
 */
export async function draftPattern({
  design,
  measurements,
  options = {},
  sa = 10,
  paperless = false,
  units = 'metric',
  renderMode = 'svg',
}) {
  const Design = DESIGNS[design?.toLowerCase()]
  if (!Design) {
    throw new Error(`Unknown design: "${design}". Available: ${Object.keys(DESIGNS).join(', ')}`)
  }

  let pattern
  try {
    pattern = new Design({
      measurements,   // 必須為 mm
      options,
      sa,
      complete: true,
      paperless,
      units,
    })
    pattern.use(themePlugin)
    pattern.draft()
  } catch (err) {
    throw new Error(`FreeSewing draft() failed for "${design}": ${err.message}`)
  }

  const logs = pattern.getLogs()

  // 致命錯誤：有任何 part 層級 error 就拋出
  const errors = [
    ...( logs.pattern?.error ?? [] ),
    ...Object.values(logs.sets ?? {}).flatMap(s => s.error ?? []),
  ]
  if (errors.length) {
    throw new Error(`Pattern errors: ${JSON.stringify(errors)}`)
  }

  if (renderMode === 'props') {
    // 給前端 @freesewing/react <Pattern> 元件用
    return { renderProps: pattern.getRenderProps(), logs }
  }

  // 預設：回傳 SVG 字串
  const rawSvg = pattern.render()
  const svg = stripFreeSewingLogo(rawSvg)
  return { svg, logs }
}

export const availableDesigns = Object.keys(DESIGNS)

function stripFreeSewingLogo(svg) {
  return svg
    // Remove logo def from defs attribute string (logo="<g id="logo" ...>")
    .replace(/\s*logo="<g id="logo"[\s\S]*?<\/g>"/g, '')
    // Remove all <use> elements referencing #logo
    .replace(/<use[^>]*xlink:href="#logo"[^>]*><\/use>/g, '')
    .replace(/<use[^>]*xlink:href="#logo"[^>]*\/>/g, '')
    // Remove standalone <g class="logo"> blocks
    .replace(/<g[^>]*class="logo"[^>]*>[\s\S]*?<\/g>/g, '')
}
