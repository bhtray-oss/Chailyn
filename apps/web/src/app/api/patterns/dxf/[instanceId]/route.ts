/**
 * GET /api/patterns/dxf/[instanceId] — 產生並下載 DXF 檔
 * 需要重新打版（使用儲存的 options + profile），回傳 DXF 文字
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { PATTERNS_DIR, PROFILES_DIR, readJson, ensureDevProfile, DEV_PROFILE_ID } from '@/lib/storage'
import { draftPattern, fillMeasurements } from '@/lib/freesewing-draft'
import type { Profile } from '@/lib/storage'

interface Params { params: { instanceId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const instance = readJson<Record<string, unknown>>(
    path.join(PATTERNS_DIR, `${params.instanceId}.json`)
  )
  if (!instance) return NextResponse.json({ detail: '找不到版型' }, { status: 404 })

  const profileId = instance.body_profile_id as string
  let profile: Profile | null =
    profileId === DEV_PROFILE_ID
      ? ensureDevProfile()
      : readJson<Profile>(path.join(PROFILES_DIR, `${profileId}.json`))

  if (!profile) return NextResponse.json({ detail: '找不到 body profile' }, { status: 404 })

  const rawMeasurements = { ...profile.measurements, ...profile.derived_measurements }
  const measurements    = await fillMeasurements(rawMeasurements, 'cisFemale')
  const optSnap      = (instance.options_snapshot ?? {}) as Record<string, unknown>
  const sa           = (instance.sa as number)        ?? 10
  const paperless    = (instance.paperless as boolean) ?? false

  try {
    const { renderProps } = await draftPattern({
      design:      instance.design as string,
      measurements,
      options:     optSnap,
      sa,
      paperless,
      renderMode:  'props',
    }) as { renderProps: unknown }

    // Simple DXF generation from renderProps
    const dxfContent = generateSimpleDxf(
      renderProps,
      `${instance.design}_sa${sa}`,
    )

    return new NextResponse(dxfContent, {
      headers: {
        'Content-Type':        'application/dxf',
        'Content-Disposition': `attachment; filename="${instance.design}_${params.instanceId.slice(0, 8)}.dxf"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ detail: msg }, { status: 422 })
  }
}

// ─── Minimal DXF generator ──────────────────────────────────────────────────
// Converts FreeSewing renderProps paths to DXF R2010 LWPOLYLINE entities

function generateSimpleDxf(renderProps: unknown, title: string): string {
  const props = renderProps as Record<string, unknown>
  const stacks = (props.stacks ?? props.parts ?? {}) as Record<string, unknown>

  const lines: string[] = [
    '0\nSECTION', '2\nHEADER',
    '9\n$ACADVER', '1\nAC1015',
    '9\n$INSUNITS', '70\n4',
    '0\nENDSEC',
    '0\nSECTION', '2\nENTITIES',
  ]

  for (const [partName, stackData] of Object.entries(stacks)) {
    const stack = stackData as Record<string, unknown>
    const parts = (stack.parts ?? {}) as Record<string, unknown>

    for (const part of Object.values(parts)) {
      const p = part as Record<string, unknown>
      const paths = ((p.paths ?? {}) as Record<string, unknown>)

      for (const pathData of Object.values(paths)) {
        const pd = pathData as Record<string, unknown>
        const ops = (pd.ops ?? []) as Array<Record<string, unknown>>
        const points = extractPolylinePoints(ops)

        if (points.length < 2) continue

        lines.push('0\nLWPOLYLINE')
        lines.push('8\n' + partName)
        lines.push('100\nAcDbEntity')
        lines.push('100\nAcDbPolyline')
        lines.push('90\n' + points.length)
        lines.push('70\n0') // not closed

        for (const [x, y] of points) {
          lines.push('10\n' + x.toFixed(4))
          lines.push('20\n' + (-y).toFixed(4)) // flip Y axis
        }
      }
    }
  }

  lines.push('0\nENDSEC', '0\nEOF')
  return lines.join('\n')
}

function extractPolylinePoints(ops: Array<Record<string, unknown>>): [number, number][] {
  const points: [number, number][] = []

  for (const op of ops) {
    const type = op.type as string
    if (type === 'move' || type === 'line') {
      const to = op.to as { x: number; y: number }
      if (to) points.push([to.x, to.y])
    } else if (type === 'curve') {
      // Bézier → approximate with midpoint only (simple version)
      const to = op.to as { x: number; y: number }
      if (to) points.push([to.x, to.y])
    }
  }

  return points
}
