/**
 * Chailyn Mobile App — Expo / React Native
 *
 * MVP 策略（07 筆記 §10 決策）：
 *   後端回傳 SVG 字串 → react-native-svg 渲染
 *   不依賴 @freesewing/react（純 web 套件）
 */

import { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { SvgXml } from 'react-native-svg'
import { StatusBar } from 'expo-status-bar'

const API_BASE = 'http://192.168.1.165:8000'
const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

const QUICK_DESIGNS = ['aaron', 'teagan', 'sandy', 'simon', 'huey']

export default function App() {
  const [tab, setTab] = useState<'analyze' | 'pattern'>('analyze')
  const [svg, setSvg] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  // design → 'loading' | svg string
  const [patternSvgs, setPatternSvgs] = useState<Record<string, string | 'loading'>>({})

  // ─── 照片分析 ──────────────────────────────────────────────────────────────
  const pickAndAnalyze = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('需要照片存取權限')
      return
    }

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
    try {
      // 1. Upload
      const form = new FormData()
      form.append('file', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: 'garment.jpg',
      } as any)

      const uploadRes = await fetch(
        `${API_BASE}/analyses/upload?user_id=${DEV_USER_ID}`,
        { method: 'POST', body: form }
      )
      if (!uploadRes.ok) throw new Error(`上傳失敗 ${uploadRes.status}`)
      const { photo_id } = await uploadRes.json()

      // 2. Create async job
      setLoadingStatus('Claude 分析中…')
      const jobRes = await fetch(`${API_BASE}/analyses/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id, user_id: DEV_USER_ID }),
      })
      const { job_id } = await jobRes.json()

      // 3. Poll until done
      let result: any = null
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const pollRes = await fetch(`${API_BASE}/analyses/jobs/${job_id}`)
        const job = await pollRes.json()
        if (job.status === 'done') { result = job.result; break }
        if (job.status === 'failed') throw new Error(job.error ?? '分析失敗')
      }
      if (!result) throw new Error('分析逾時，請再試一次')
      setAnalysis(result)
    } catch (e: any) {
      Alert.alert('分析失敗', e.message)
    } finally {
      setLoading(false)
      setLoadingStatus('')
    }
  }

  // ─── 打版（推薦 or 自選）───────────────────────────────────────────────────
  const draftDesign = async (design: string) => {
    setLoading(true)
    setSvg(null)
    setLoadingStatus(`${design} 打版中…`)
    try {
      const res = await fetch(`${API_BASE}/patterns/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: DEV_USER_ID,
          design,
          body_profile_id: DEV_PROFILE_ID,
          sa: 10,
          render_mode: 'svg',
        }),
      })
      const data = await res.json()
      setSvg(data.svg)
    } catch (e: any) {
      Alert.alert('打版失敗', e.message)
    } finally {
      setLoading(false)
      setLoadingStatus('')
    }
  }

  // ─── 推薦版型打版（分析結果頁用，不切 tab）────────────────────────────────
  const draftRecommended = async (design: string) => {
    setPatternSvgs(prev => ({ ...prev, [design]: 'loading' }))
    try {
      const res = await fetch(`${API_BASE}/patterns/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: DEV_USER_ID,
          design,
          body_profile_id: DEV_PROFILE_ID,
          sa: 10,
          render_mode: 'svg',
        }),
      })
      const data = await res.json()
      setPatternSvgs(prev => ({ ...prev, [design]: data.svg ?? '' }))
    } catch {
      setPatternSvgs(prev => { const n = { ...prev }; delete n[design]; return n })
      Alert.alert('打版失敗', `無法取得 ${design} 版型`)
    }
  }

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
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'analyze' ? '分析照片' : '版型'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16 }}>
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#292524" />
            <Text style={styles.hint}>{loadingStatus || '處理中…'}</Text>
          </View>
        )}

        {/* ── Analyze tab ─────────────────────────────────────────────────── */}
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
                  <Row label="難度" value={
                    analysis.difficulty_estimate
                      ? '★'.repeat(analysis.difficulty_estimate)
                      : undefined
                  } />
                </View>

                {/* 推薦版型 + SVG 預覽 */}
                <Text style={styles.sectionLabel}>推薦 FreeSewing 版型</Text>
                {(analysis.closest_freesewing_patterns ?? []).map((p: any) => {
                  const svgState = patternSvgs[p.design]
                  return (
                    <View key={p.design} style={styles.card}>
                      {/* 版型名稱 + 符合度 */}
                      <View style={styles.row}>
                        <Text style={[styles.rowLabel, { fontWeight: '700', fontSize: 15, color: '#1c1917' }]}>
                          {p.design.charAt(0).toUpperCase() + p.design.slice(1)}
                        </Text>
                        <Text style={styles.matchBadge}>{Math.round(p.confidence * 100)}% 符合</Text>
                      </View>

                      {p.reasoning && (
                        <Text style={styles.reasoning}>{p.reasoning}</Text>
                      )}

                      {/* 預覽按鈕 */}
                      {!svgState && (
                        <TouchableOpacity
                          style={styles.previewBtn}
                          onPress={() => draftRecommended(p.design)}
                        >
                          <Text style={styles.previewBtnText}>🪡 預覽版型圖樣</Text>
                        </TouchableOpacity>
                      )}

                      {/* 打版中 */}
                      {svgState === 'loading' && (
                        <View style={styles.svgLoading}>
                          <ActivityIndicator size="small" color="#78716c" />
                          <Text style={styles.hint}>打版中…</Text>
                        </View>
                      )}

                      {/* SVG 圖樣 */}
                      {svgState && svgState !== 'loading' && (
                        <View style={{ marginTop: 10 }}>
                          <View style={styles.svgWrap}>
                            <SvgXml xml={svgState} width="100%" />
                          </View>
                          <TouchableOpacity
                            style={styles.collapseBtn}
                            onPress={() => setPatternSvgs(prev => {
                              const n = { ...prev }; delete n[p.design]; return n
                            })}
                          >
                            <Text style={styles.collapseBtnText}>收起圖樣</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Pattern tab ─────────────────────────────────────────────────── */}
        {tab === 'pattern' && !loading && (
          <View style={{ gap: 12 }}>
            <Text style={styles.sectionLabel}>快速打版</Text>
            {QUICK_DESIGNS.map((d) => (
              <TouchableOpacity
                key={d}
                style={styles.designBtn}
                onPress={() => draftDesign(d)}
              >
                <Text style={styles.designBtnText}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
                <Text style={styles.designBtnArrow}>→</Text>
              </TouchableOpacity>
            ))}

            {svg && (
              <View style={styles.svgWrap}>
                <SvgXml xml={svg} width="100%" />
              </View>
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
  container: { flex: 1, backgroundColor: '#fafaf9' },
  header: {
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e7e5e4',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1c1917' },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e7e5e4',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1c1917' },
  tabText: { fontSize: 14, color: '#78716c' },
  tabTextActive: { color: '#1c1917', fontWeight: '600' },
  body: { flex: 1 },
  centered: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  hint: { color: '#78716c', fontSize: 13 },
  primaryBtn: {
    backgroundColor: '#1c1917', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#e7e5e4', padding: 16, gap: 8,
  },
  cardTitle: {
    fontSize: 11, fontWeight: '700', color: '#a8a29e',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 13, color: '#78716c' },
  rowValue: { fontSize: 13, fontWeight: '500', color: '#1c1917' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#a8a29e',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  matchBadge: {
    fontSize: 11, color: '#78716c',
    backgroundColor: '#f5f5f4', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20,
  },
  reasoning: { fontSize: 12, color: '#a8a29e', lineHeight: 18 },
  previewBtn: {
    marginTop: 4, borderWidth: 1, borderColor: '#d6d3d1',
    borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  previewBtnText: { fontSize: 13, fontWeight: '500', color: '#44403c' },
  svgLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  svgWrap: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1,
    borderColor: '#e7e5e4', padding: 8,
  },
  collapseBtn: { marginTop: 6, alignItems: 'center', paddingVertical: 4 },
  collapseBtnText: { fontSize: 12, color: '#a8a29e' },
  designBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e7e5e4',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  designBtnText: { fontSize: 15, fontWeight: '500', color: '#1c1917' },
  designBtnArrow: { fontSize: 15, color: '#a8a29e' },
})
