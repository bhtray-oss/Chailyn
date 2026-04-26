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
    try {
      // Upload
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
      const { photo_id } = await uploadRes.json()

      // Analyze
      const analyzeRes = await fetch(`${API_BASE}/analyses/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id, user_id: DEV_USER_ID }),
      })
      const { result } = await analyzeRes.json()
      setAnalysis(result)
    } catch (e: any) {
      Alert.alert('分析失敗', e.message)
    } finally {
      setLoading(false)
    }
  }

  // ─── 版型打版 ──────────────────────────────────────────────────────────────
  const draftDesign = async (design: string) => {
    setLoading(true)
    setSvg(null)
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
            <Text style={styles.hint}>
              {tab === 'analyze' ? 'Claude 分析中…' : '打版中…'}
            </Text>
          </View>
        )}

        {/* Analyze tab */}
        {tab === 'analyze' && !loading && (
          <View style={{ gap: 16 }}>
            <TouchableOpacity style={styles.primaryBtn} onPress={pickAndAnalyze}>
              <Text style={styles.primaryBtnText}>📸 上傳服裝照片</Text>
            </TouchableOpacity>

            {analysis && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>分析結果</Text>
                <Row label="主布料" value={analysis.fabric?.primary?.name} />
                <Row label="成分" value={analysis.fabric?.primary?.composition_estimate} />
                <Row label="輪廓" value={analysis.cut?.silhouette} />
                <Row label="推薦版型" value={
                  analysis.closest_freesewing_patterns
                    ?.slice(0, 2)
                    .map((p: any) => p.design)
                    .join(' / ')
                } />
              </View>
            )}
          </View>
        )}

        {/* Pattern tab */}
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
  hint: { color: '#78716c', fontSize: 14 },
  primaryBtn: {
    backgroundColor: '#1c1917', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#e7e5e4', padding: 16, gap: 8,
  },
  cardTitle: { fontSize: 12, fontWeight: '600', color: '#a8a29e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, color: '#78716c' },
  rowValue: { fontSize: 13, fontWeight: '500', color: '#1c1917' },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#a8a29e', letterSpacing: 1, textTransform: 'uppercase' },
  designBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e7e5e4',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  designBtnText: { fontSize: 15, fontWeight: '500', color: '#1c1917' },
  designBtnArrow: { fontSize: 15, color: '#a8a29e' },
  svgWrap: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1,
    borderColor: '#e7e5e4', padding: 12, marginTop: 8,
  },
})
