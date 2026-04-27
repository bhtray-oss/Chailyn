/**
 * freesewing-draft.ts — 伺服器端 FreeSewing 打版（僅供 API routes 使用）
 * 使用動態 import 確保 ESM-only FreeSewing 套件正常載入
 */

export interface DraftParams {
  design:       string
  measurements: Record<string, number>
  options?:     Record<string, unknown>
  sa?:          number
  paperless?:   boolean
  renderMode?:  'svg' | 'props'
  gender?:      string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const DESIGN_LOADERS: Record<string, () => Promise<new (cfg: unknown) => any>> = {
  aaron:   async () => (await import('@freesewing/aaron')).Aaron,
  bella:   async () => (await import('@freesewing/bella')).Bella,
  bibi:    async () => (await import('@freesewing/bibi')).Bibi,
  brian:   async () => (await import('@freesewing/brian')).Brian,
  carlita: async () => (await import('@freesewing/carlita')).Carlita,
  carlton: async () => (await import('@freesewing/carlton')).Carlton,
  huey:    async () => (await import('@freesewing/huey')).Huey,
  lily:    async () => (await import('@freesewing/lily')).Lily,
  paco:    async () => (await import('@freesewing/paco')).Paco,
  sandy:   async () => (await import('@freesewing/sandy')).Sandy,
  simon:   async () => (await import('@freesewing/simon')).Simon,
  simone:  async () => (await import('@freesewing/simone')).Simone,
  teagan:  async () => (await import('@freesewing/teagan')).Teagan,
  titan:   async () => (await import('@freesewing/titan')).Titan,
  waralee: async () => (await import('@freesewing/waralee')).Waralee,
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const AVAILABLE_DESIGNS = Object.keys(DESIGN_LOADERS)

/**
 * 用 @freesewing/models 的模板補全缺失的身材數據（mm）
 */
export async function fillMeasurements(
  measurements: Record<string, number>,
  gender: string = 'cisFemale',
): Promise<Record<string, number>> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const models = await import('@freesewing/models') as any
  const base = gender === 'cisMale'
    ? { ...models.cisMaleAdult38 }
    : { ...models.cisFemaleAdult38 }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const filled = { ...base }
  for (const [key, val] of Object.entries(measurements)) {
    if (typeof val === 'number' && val > 0) filled[key] = val
  }
  return filled
}

export async function draftPattern(params: DraftParams) {
  const {
    design,
    measurements,
    options    = {},
    sa         = 10,
    paperless  = false,
    renderMode = 'svg',
  } = params

  const designLower  = design.toLowerCase()
  const designLoader = DESIGN_LOADERS[designLower]
  if (!designLoader) {
    throw new Error(`Unknown design: "${design}". Available: ${AVAILABLE_DESIGNS.join(', ')}`)
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [Design, { themePlugin }] = await Promise.all([
    designLoader(),
    import('@freesewing/plugin-theme') as Promise<any>,
  ])

  const pattern: any = new Design({
    measurements,
    options,
    sa,
    complete:  true,
    paperless,
    units:     'metric',
  })
  pattern.use(themePlugin)
  pattern.draft()

  const logs: any = pattern.getLogs()
  const errors: string[] = [
    ...(logs.pattern?.error ?? []),
    ...Object.values(logs.sets ?? {}).flatMap((s: any) => s.error ?? []),
  ]
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (errors.length) {
    throw new Error(`Pattern errors: ${JSON.stringify(errors)}`)
  }

  if (renderMode === 'props') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { renderProps: pattern.getRenderProps() as any, logs }
  }

  const rawSvg = pattern.render() as string
  const svg    = stripFreeSewingLogo(rawSvg)
  return { svg, logs }
}

function stripFreeSewingLogo(svg: string): string {
  return svg
    .replace(/\s*logo="<g id="logo"[\s\S]*?<\/g>"/g, '')
    .replace(/<use[^>]*xlink:href="#logo"[^>]*><\/use>/g, '')
    .replace(/<use[^>]*xlink:href="#logo"[^>]*\/>/g, '')
    .replace(/<g[^>]*class="logo"[^>]*>[\s\S]*?<\/g>/g, '')
}
