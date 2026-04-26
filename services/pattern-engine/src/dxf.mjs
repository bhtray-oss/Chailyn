/**
 * dxf.mjs — 從 FreeSewing renderProps 生成 DXF 格式
 *
 * 流程：
 *  1. 以 renderMode='props' 取得路徑點資料（不需要 SVG parsing）
 *  2. 把每個 part 的 paths 轉成 DXF LWPOLYLINE / SPLINE
 *  3. 輸出標準 DXF R2010 ASCII 格式
 *
 * DXF 結構：HEADER → TABLES → BLOCKS → ENTITIES → EOF
 * 每個 FreeSewing part → 獨立 LAYER
 */

/**
 * 把 FreeSewing renderProps 輸出成 DXF ASCII 字串
 * @param {object} renderProps  - pattern.getRenderProps() 的回傳值
 * @param {{ title?: string, units?: 'mm'|'cm' }} opts
 * @returns {string}  DXF 內容字串
 */
export function renderPropsToDxf(renderProps, opts = {}) {
  const { title = 'ChailynPattern', units = 'mm' } = opts
  const scale = units === 'cm' ? 0.1 : 1   // FreeSewing 內部單位是 mm

  const lines = []

  // ─── SECTION HEADER ──────────────────────────────────────────────────────
  lines.push(
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1015',          // AutoCAD 2000 / R2010 compatible
    '9', '$INSUNITS', '70', units === 'mm' ? '4' : '5',  // 4=mm, 5=cm
    '9', '$MEASUREMENT', '70', '1',           // metric
    '9', '$EXTMIN',
    '10', '0.0', '20', '0.0', '30', '0.0',
    '9', '$EXTMAX',
    '10', '1000.0', '20', '1000.0', '30', '0.0',
    '0', 'ENDSEC',
  )

  // ─── SECTION TABLES ───────────────────────────────────────────────────────
  lines.push('0', 'SECTION', '2', 'TABLES')

  // LAYER table：每個 part 一層
  const stacks = renderProps.stacks ?? {}
  const layerNames = Object.keys(stacks)

  lines.push(
    '0', 'TABLE', '2', 'LAYER',
    '70', String(layerNames.length + 1),
    // 預設層
    '0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS',
  )
  layerNames.forEach((name, i) => {
    lines.push(
      '0', 'LAYER',
      '2', sanitizeLayerName(name),
      '70', '0',           // not frozen/locked
      '62', String((i % 7) + 1),  // colour 1-7 cycle
      '6', 'CONTINUOUS',
    )
  })
  lines.push('0', 'ENDTAB')
  lines.push('0', 'ENDSEC')

  // ─── SECTION ENTITIES ─────────────────────────────────────────────────────
  lines.push('0', 'SECTION', '2', 'ENTITIES')

  // Title text
  lines.push(
    '0',   'TEXT',
    '100', 'AcDbEntity',
    '8',   '0',
    '100', 'AcDbText',
    '10',  '0', '20', String(-15 * scale), '30', '0',
    '40',  String(5 * scale),
    '1',   title,
  )

  // Walk each stack (= part layout position)
  for (const [stackName, stack] of Object.entries(stacks)) {
    const layer    = sanitizeLayerName(stackName)
    const offsetX  = (stack.layout?.move?.x ?? 0) * scale
    const offsetY  = (stack.layout?.move?.y ?? 0) * scale

    // Each part inside the stack
    for (const part of (stack.parts ?? [])) {
      const paths = part.paths ?? {}
      for (const [, pathObj] of Object.entries(paths)) {
        if (!pathObj?.ops) continue

        const segments = collectSegments(pathObj.ops, offsetX, offsetY, scale)
        for (const seg of segments) {
          if (seg.type === 'polyline') {
            emitLwPolyline(lines, layer, seg.points, seg.closed)
          } else if (seg.type === 'spline') {
            emitSpline(lines, layer, seg.points)
          }
        }
      }
    }
  }

  lines.push('0', 'ENDSEC')
  lines.push('0', 'EOF')

  return lines.join('\n')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 把 FreeSewing ops 陣列轉成可繪製的 segments */
function collectSegments(ops, offsetX, offsetY, scale) {
  const segments = []
  let current = []
  let closed  = false

  const push = (x, y) => current.push([
    round(x * scale + offsetX),
    round(-y * scale + offsetY),   // DXF Y 軸向上，FreeSewing Y 向下，需翻轉
  ])

  for (const op of ops) {
    switch (op.type) {
      case 'move':
        if (current.length > 1) {
          segments.push({ type: 'polyline', points: current, closed })
        }
        current = []
        closed  = false
        push(op.to.x, op.to.y)
        break
      case 'line':
        push(op.to.x, op.to.y)
        break
      case 'curve': {
        // 三次 Bézier → 取樣成 LWPOLYLINE（每段分 12 個點）
        const last = current[current.length - 1] ?? [0, 0]
        const pts = sampleCubicBezier(
          { x: (last[0] - offsetX) / scale, y: -(last[1] - offsetY) / scale },
          op.cp1, op.cp2, op.to,
          12,
        )
        pts.forEach(p => push(p.x, p.y))
        break
      }
      case 'close':
        closed = true
        break
      default:
        break
    }
  }

  if (current.length > 1) {
    segments.push({ type: 'polyline', points: current, closed })
  }
  return segments
}

/** 三次 Bézier 取樣（跳過第一個點，它已在 current 末端） */
function sampleCubicBezier(p0, p1, p2, p3, n = 12) {
  const result = []
  for (let i = 1; i <= n; i++) {
    const t  = i / n
    const mt = 1 - t
    result.push({
      x: mt**3 * p0.x + 3*mt**2*t * p1.x + 3*mt*t**2 * p2.x + t**3 * p3.x,
      y: mt**3 * p0.y + 3*mt**2*t * p1.y + 3*mt*t**2 * p2.y + t**3 * p3.y,
    })
  }
  return result
}

/** 輸出 DXF LWPOLYLINE（含必要 subclass markers） */
function emitLwPolyline(lines, layer, points, closed = false) {
  if (points.length < 2) return
  lines.push(
    '0',   'LWPOLYLINE',
    '100', 'AcDbEntity',        // entity subclass marker (required)
    '8',   layer,               // layer
    '100', 'AcDbPolyline',      // polyline subclass marker (required)
    '90',  String(points.length),
    '70',  closed ? '1' : '0',  // flag: 1=closed
    '43',  '0',                  // constant width
  )
  for (const [x, y] of points) {
    lines.push('10', String(x), '20', String(y))
  }
}

/** 輸出 DXF SPLINE（degree 3，非有理） */
function emitSpline(lines, layer, points) {
  if (points.length < 2) return
  // 退化成 polyline（spline 需要 knot vectors，比較複雜）
  emitLwPolyline(lines, layer, points, false)
}

function sanitizeLayerName(name) {
  return name.replace(/[<>/\\:?"*|]/g, '_').substring(0, 31)
}

function round(n) {
  return Math.round(n * 1000) / 1000
}
