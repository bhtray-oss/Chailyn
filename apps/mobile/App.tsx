/**
 * Chailyn Mobile App — Expo / React Native SDK 54
 */

import { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Dimensions,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { SvgXml } from 'react-native-svg'
import { StatusBar } from 'expo-status-bar'

const API_BASE = 'http://192.168.1.165:8000'
const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

const QUICK_DESIGNS = ['aaron', 'teagan', 'sandy', 'simon', 'huey']
const SCREEN_W = Dimensions.get('window').width

export default function App() {
  const [tab, setTab] = useState<'analyze' | 'pattern'>('analyze')
  const [svg, setSvg] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')

  // 推薦版型預覽：design → 'loading' | svg string
  const [patternSvgs, setPatternSvgs] = useState<Record<string, string | 'loading'>>({})
  const [activePreview, setActivePreview] = useState<string | null>(null)
  // 縮放比例 (%)
  const [zoom, setZoom] = useState(100)
  const scrollRef = useRef<ScrollView>(null)

  // ─── 照片分析 ──────────────────────────────────────────────────────────────
  const pickAndAnalyze = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('需要照片存取權限'); return }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: false,
    })
    if (picked.canceled || !picked.assets[0]) return
    const asset = picked.assets[0]

    setLoading(true)
    setLoadingStatus('照片上傳中…')
    setAnalysis(null)
    setPatternSvgs({})
    setActivePreview(null)

    try {
      // 1. Upload
      const form = new FormData()
      form.append('file', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: 'garment.jpg' } as any)
      const uploadRes = await fetch(`${API_BASE}/analyses/upload?user_id=${DEV_USER_ID}`, { method: 'POST', body: form })
      if (!uploadRes.ok) throw new Error(`上傳失敗 ${uploadRes.status}`)
      const { photo_id } = await uploadRes.json()

      // 2. 建立非同步 Job
      setLoadingStatus('Claude 分析中…')
      const jobRes = await fetch(`${API_BASE}/analyses/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id, user_id: DEV_USER_ID }),
      })
      const { job_id } = await jobRes.json()

      // 3. 輪詢
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const poll = await fetch(`${API_BASE}/analyses/jobs/${job_id}`)
        const job = await poll.json()
        if (job.status === 'done') { setAnalysis(job.result); break }
        if (job.status === 'failed') throw new Error(job.error ?? '分析失敗')
        if (i === 59) throw new Error('分析逾時，請再試一次')
      }
    } catch (e: any) {
      Alert.alert('分析失敗', e.message)
    } finally {
      setLoading(false)
      setLoadingStatus('')
    }
  }

  // ─── 版型打版（版型 tab 用）────────────────────────────────────────────────
  const draftDesign = async (design: string) => {
    setLoading(true); setSvg(null)
    setLoadingStatus(`${design} 打版中…`)
    try {
      const res = await fetch(`${API_BASE}/patterns/draft`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: DEV_USER_ID, design, body_profile_id: DEV_PROFILE_ID, sa: 10, render_mode: 'svg' }),
      })
      const data = await res.json()
      setSvg(data.svg)
    } catch (e: any) { Alert.alert('打版失敗', e.message) }
    finally { setLoading(false); setLoadingStatus('') }
  }

  // ─── 推薦版型預覽（分析結果用）────────────────────────────────────────────
  const draftRecommended = async (design: string) => {
    setActivePreview(design)
    setZoom(100)
    if (patternSvgs[design] && patternSvgs[design] !== 'loading') return
    setPatternSvgs(prev => ({ ...prev, [design]: 'loading' }))
    try {
      const res = await fetch(`${API_BASE}/patterns/draft`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: DEV_USER_ID, design, body_profile_id: DEV_PROFILE_ID, sa: 10, render_mode: 'svg' }),
      })
      const data = await res.json()
      setPatternSvgs(prev => ({ ...prev, [design]: data.svg ?? '' }))
    } catch {
      setPatternSvgs(prev => { const n = { ...prev }; delete n[design]; return n })
      setActivePreview(null)
      Alert.alert('打版失敗', `無法取得 ${design} 版型`)
    }
  }

  const activeSvg = activePreview ? patternSvgs[activePreview] : null
  const svgDisplayWidth = SCREEN_W * (zoom / 100)

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chailyn</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['analyze', 'pattern'] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'analyze' ? '分析照片' : '版型'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={{ padding: 16 }}>

        {/* ── 全域 loading ────────────────────────────────────────────────── */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#292524" />
            <Text style={styles.hint}>{loadingStatus || '處理中…'}</Text>
          </View>
        )}

        {/* ── 分析照片 tab ──────────────────────────────────────────────── */}
        {tab === 'analyze' && !loading && (
          <View style={{ gap: 16 }}>
            <TouchableOpacity style={styles.primaryBtn} onPress={pickAndAnalyze}>
              <Text style={styles.primaryBtnText}>📸 上傳服裝照片</Text>
            </TouchableOpacity>

            {analysis && (
              <View style={{ gap: 12 }}>
                {/* 分析結果卡片 */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>分析結果</Text>
                  <Row label="主布料" value={analysis.fabric?.primary?.name} />
                  <Row label="成分" value={analysis.fabric?.primary?.composition_estimate} />
                  <Row label="廓形" value={analysis.cut?.silhouette} />
                  <Row label="鬆量" value={analysis.cut?.fit_ease} />
                  <Row label="領型" value={analysis.components?.collar?.type ?? analysis.components?.collar} />
                  <Row label="袖型" value={analysis.components?.sleeves?.type ?? analysis.components?.sleeves} />
                  <Row label="難度" value={analysis.difficulty_estimate ? '★'.repeat(analysis.difficulty_estimate) : undefined} />
                </View>

                {/* 推薦版型列表 */}
                <Text style={styles.sectionLabel}>推薦 FreeSewing 版型</Text>
                {(analysis.closest_freesewing_patterns ?? []).map((p: any) => {
                  const isActive = activePreview === p.design
                  const state = patternSvgs[p.design]
                  return (
                    <View key={p.design} style={styles.card}>
                      <View style={styles.row}>
                        <Text style={styles.designName}>
                          {p.design.charAt(0).toUpperCase() + p.design.slice(1)}
                        </Text>
                        <Text style={styles.matchBadge}>{Math.round(p.confidence * 100)}% 符合</Text>
                      </View>
                      {p.reasoning && <Text style={styles.reasoning}>{p.reasoning}</Text>}

                      <TouchableOpacity
                        style={[styles.previewBtn, isActive && state && state !== 'loading' && styles.previewBtnActive]}
                        onPress={() => draftRecommended(p.design)}
                        disabled={state === 'loading'}
                      >
                        <Text style={[styles.previewBtnText, isActive && state && state !== 'loading' && styles.previewBtnTextActive]}>
                          {state === 'loading' ? '打版中…' : isActive && state ? '✓ 預覽中' : '🪡 預覽版型圖樣'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )
                })}

                {/* ── 全寬 SVG 版型預覽 ─────────────────────────────────── */}
                {activePreview && (
                  <View style={styles.previewPanel}>
                    {/* 工具列 */}
                    <View style={styles.previewToolbar}>
                      <Text style={styles.previewTitle}>
                        {activePreview.charAt(0).toUpperCase() + activePreview.slice(1)} 版型圖樣
                      </Text>
                      <TouchableOpacity onPress={() => setActivePreview(null)}>
                        <Text style={styles.closeBtn}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    {/* 縮放控制 */}
                    {activeSvg && activeSvg !== 'loading' && (
                      <View style={styles.zoomBar}>
                        <TouchableOpacity
                          style={styles.zoomBtn}
                          onPress={() => setZoom(z => Math.max(30, z - 15))}
                        >
                          <Text style={styles.zoomBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.zoomLabel}>{zoom}%</Text>
                        <TouchableOpacity
                          style={styles.zoomBtn}
                          onPress={() => setZoom(z => Math.min(300, z + 15))}
                        >
                          <Text style={styles.zoomBtnText}>+</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.zoomBtn, { marginLeft: 8, paddingHorizontal: 10 }]}
                          onPress={() => setZoom(100)}
                        >
                          <Text style={[styles.zoomBtnText, { fontSize: 11 }]}>重置</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* SVG 顯示：可水平捲動 */}
                    {activeSvg === 'loading' ? (
                      <View style={styles.svgLoading}>
                        <ActivityIndicator size="large" color="#78716c" />
                        <Text style={styles.hint}>正在生成 {activePreview} 版型…</Text>
                      </View>
                    ) : activeSvg ? (
                      <ScrollView
                        horizontal
                        style={styles.svgScrollH}
                        contentContainerStyle={{ minWidth: svgDisplayWidth + 32 }}
                        maximumZoomScale={3}
                        minimumZoomScale={0.3}
                        showsHorizontalScrollIndicator
                        showsVerticalScrollIndicator
                      >
                        <ScrollView
                          contentContainerStyle={{ padding: 16 }}
                          showsVerticalScrollIndicator
                        >
                          <SvgXml
                            xml={activeSvg}
                            width={svgDisplayWidth}
                            height={svgDisplayWidth * 1.4}
                          />
                        </ScrollView>
                      </ScrollView>
                    ) : null}

                    {/* 底部：完整打版按鈕 */}
                    {activeSvg && activeSvg !== 'loading' && (
                      <View style={styles.previewFooter}>
                        <Text style={styles.previewFooterHint}>縫份 10mm・FreeSewing v4</Text>
                        <TouchableOpacity
                          style={styles.draftBtn}
                          onPress={() => setTab('pattern')}
                        >
                          <Text style={styles.draftBtnText}>切換到版型 tab →</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── 版型 tab ──────────────────────────────────────────────────── */}
        {tab === 'pattern' && !loading && (
          <View style={{ gap: 12 }}>
            <Text style={styles.sectionLabel}>快速打版</Text>
            {QUICK_DESIGNS.map((d) => (
              <TouchableOpacity key={d} style={styles.designBtn} onPress={() => draftDesign(d)}>
                <Text style={styles.designBtnText}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
                <Text style={styles.designBtnArrow}>→</Text>
              </TouchableOpacity>
            ))}

            {svg && (
              <>
                <View style={styles.zoomBar}>
                  <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoom(z => Math.max(30, z - 15))}>
                    <Text style={styles.zoomBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.zoomLabel}>{zoom}%</Text>
                  <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoom(z => Math.min(300, z + 15))}>
                    <Text style={styles.zoomBtnText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.zoomBtn, { marginLeft: 8, paddingHorizontal: 10 }]} onPress={() => setZoom(100)}>
                    <Text style={[styles.zoomBtnText, { fontSize: 11 }]}>重置</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  style={styles.svgScrollH}
                  contentContainerStyle={{ minWidth: svgDisplayWidth + 32 }}
                  maximumZoomScale={3}
                  minimumZoomScale={0.3}
                  showsHorizontalScrollIndicator
                >
                  <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator>
                    <SvgXml xml={svg} width={svgDisplayWidth} height={svgDisplayWidth * 1.4} />
                  </ScrollView>
                </ScrollView>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ?? '—'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#fafaf9' },
  header:       { paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e7e5e4' },
  headerTitle:  { fontSize: 20, fontWeight: '700', color: '#1c1917' },
  tabBar:       { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e7e5e4' },
  tab:          { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: '#1c1917' },
  tabText:      { fontSize: 14, color: '#78716c' },
  tabTextActive:{ color: '#1c1917', fontWeight: '600' },
  body:         { flex: 1 },
  centered:     { alignItems: 'center', paddingVertical: 40, gap: 12 },
  hint:         { color: '#78716c', fontSize: 13 },
  primaryBtn:   { backgroundColor: '#1c1917', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card:         { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e7e5e4', padding: 16, gap: 8 },
  cardTitle:    { fontSize: 11, fontWeight: '700', color: '#a8a29e', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel:     { fontSize: 13, color: '#78716c' },
  rowValue:     { fontSize: 13, fontWeight: '500', color: '#1c1917' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#a8a29e', letterSpacing: 1.2, textTransform: 'uppercase' },
  designName:   { fontSize: 15, fontWeight: '700', color: '#1c1917' },
  matchBadge:   { fontSize: 11, color: '#78716c', backgroundColor: '#f5f5f4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  reasoning:    { fontSize: 12, color: '#a8a29e', lineHeight: 18 },
  previewBtn:   { borderWidth: 1, borderColor: '#d6d3d1', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  previewBtnActive: { backgroundColor: '#1c1917', borderColor: '#1c1917' },
  previewBtnText: { fontSize: 13, fontWeight: '500', color: '#44403c' },
  previewBtnTextActive: { color: '#fff' },

  // 全寬預覽面板
  previewPanel: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e7e5e4', overflow: 'hidden' },
  previewToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#f5f5f4', borderBottomWidth: 1, borderBottomColor: '#e7e5e4' },
  previewTitle: { fontSize: 14, fontWeight: '700', color: '#1c1917' },
  closeBtn:     { fontSize: 16, color: '#a8a29e', paddingHorizontal: 4 },
  zoomBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fafaf9', borderBottomWidth: 1, borderBottomColor: '#f0eeed' },
  zoomBtn:      { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#d6d3d1', alignItems: 'center', justifyContent: 'center' },
  zoomBtnText:  { fontSize: 16, color: '#44403c', fontWeight: '600' },
  zoomLabel:    { fontSize: 13, fontWeight: '600', color: '#1c1917', minWidth: 44, textAlign: 'center' },
  svgLoading:   { alignItems: 'center', paddingVertical: 48, gap: 12 },
  svgScrollH:   { maxHeight: 500 },
  previewFooter:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f5f5f4', borderTopWidth: 1, borderTopColor: '#e7e5e4' },
  previewFooterHint: { fontSize: 11, color: '#a8a29e' },
  draftBtn:     { backgroundColor: '#1c1917', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  draftBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  designBtn:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e7e5e4', paddingHorizontal: 16, paddingVertical: 14 },
  designBtnText:{ fontSize: 15, fontWeight: '500', color: '#1c1917' },
  designBtnArrow: { fontSize: 15, color: '#a8a29e' },
})
