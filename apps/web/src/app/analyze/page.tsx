'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { analysisApi, jobApi, patternApi } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'
import type { AnalysisJob } from '@/lib/api'

// DEV 用：硬編一個 user_id，正式版改從 auth context 取
const DEV_USER_ID     = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID  = '00000000-0000-0000-0000-000000000002'

type Step = 'upload' | 'uploading' | 'analyzing' | 'result'

const STATUS_LABEL: Record<string, string> = {
  pending: '排隊等待中…',
  running: 'Claude 正在分析照片…',
  done:    '分析完成',
  failed:  '分析失敗',
}

export default function AnalyzePage() {
  const [step, setStep]         = useState<Step>('upload')
  const [preview, setPreview]   = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<GarmentAnalysis | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string>('')
  // design → 'loading' | svg string
  const [patternSvgs, setPatternSvgs] = useState<Record<string, string | 'loading'>>({})

  const draftPattern = useCallback(async (design: string) => {
    setPatternSvgs(prev => ({ ...prev, [design]: 'loading' }))
    try {
      const data = await patternApi.draft({
        userId: DEV_USER_ID,
        design,
        bodyProfileId: DEV_PROFILE_ID,
        sa: 10,
        renderMode: 'svg',
      }) as any
      setPatternSvgs(prev => ({ ...prev, [design]: data.svg ?? '' }))
    } catch {
      setPatternSvgs(prev => { const n = { ...prev }; delete n[design]; return n })
    }
  }, [])

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return

    setPreview(URL.createObjectURL(file))
    setError(null)
    setJobStatus('')

    try {
      // 1. 上傳照片
      setStep('uploading')
      let uploadResult: { photo_id: string }
      try {
        uploadResult = await analysisApi.uploadPhoto(DEV_USER_ID, file)
      } catch (e: any) {
        const msg = e.message ?? ''
        if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
          throw new Error('無法連線到伺服器（API :8000 未啟動？），請確認後端服務正在執行。')
        }
        throw new Error(`上傳失敗：${msg}`)
      }
      const { photo_id } = uploadResult

      // 2. 建立非同步 Job
      setStep('analyzing')
      const { job_id } = await jobApi.create(photo_id, DEV_USER_ID)

      // 3. 輪詢直到完成
      const job: AnalysisJob = await jobApi.waitUntilDone(
        job_id,
        (j) => setJobStatus(STATUS_LABEL[j.status] ?? j.status),
      )

      if (job.status === 'failed') {
        const errMsg = job.error ?? '分析失敗，請再試一次'
        if (errMsg.includes('credit balance') || errMsg.includes('billing')) {
          throw new Error('Anthropic 帳戶餘額不足，請至 console.anthropic.com 加值')
        }
        if (errMsg.includes('Could not process image')) {
          throw new Error('圖片格式不支援或品質太低，請換一張清晰的服裝照片')
        }
        throw new Error(errMsg)
      }

      setAnalysis(job.result as GarmentAnalysis)
      setStep('result')
    } catch (e: any) {
      setError(e.message ?? '發生錯誤，請再試一次')
      setStep('upload')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: step === 'uploading' || step === 'analyzing',
  })

  const isLoading = step === 'uploading' || step === 'analyzing'

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-900 mb-2">服裝照片分析</h1>
      <p className="text-stone-500 mb-8">上傳 1 張服裝照片，AI 將自動識別材質、剪裁與推薦版型</p>

      {/* Upload zone */}
      {step !== 'result' && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-amber-500 bg-amber-50' : 'border-stone-300 hover:border-stone-400 bg-white'}
            ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />

          {step === 'uploading' && (
            <div>
              <div className="text-3xl mb-3 animate-spin inline-block">⟳</div>
              <p className="text-stone-600">照片上傳中…</p>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="space-y-3">
              {/* 進度脈動條 */}
              <div className="w-48 h-1.5 mx-auto bg-stone-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full animate-pulse w-2/3" />
              </div>
              <p className="text-stone-600 text-sm">{jobStatus || 'Claude 正在分析照片…'}</p>
            </div>
          )}

          {step === 'upload' && (
            <div>
              <div className="text-4xl mb-3">📸</div>
              <p className="text-stone-700 font-medium">
                {isDragActive ? '放開以上傳' : '拖拉照片到此，或點擊選擇'}
              </p>
              <p className="text-stone-400 text-sm mt-2">支援 JPG、PNG、WebP，最大 10MB</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {step === 'result' && analysis && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Photo preview */}
          {preview && (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="上傳的服裝" className="w-full object-cover" />
            </div>
          )}

          {/* Analysis cards */}
          <div className="flex flex-col gap-4">
            {/* Fabric */}
            <Card title="布料">
              <Row label="主布" value={analysis.fabric?.primary?.name} />
              <Row label="成分" value={analysis.fabric?.primary?.composition_estimate} />
              <Row label="重量" value={(analysis.fabric?.primary as any)?.weight} />
              <Row label="垂墜" value={analysis.fabric?.primary?.drape != null ? `${analysis.fabric.primary.drape}/10` : null} />
              <Row label="厚度" value={analysis.fabric?.primary?.thickness != null ? `${analysis.fabric.primary.thickness}/10` : null} />
            </Card>

            {/* Cut */}
            <Card title="剪裁版型">
              <Row label="廓形" value={analysis.cut?.silhouette} />
              <Row label="鬆量" value={(analysis.cut as any)?.fit_ease ?? (analysis.cut as any)?.ease_estimate} />
              <Row label="腰部" value={(analysis.cut as any)?.waist_treatment} />
              <Row label="類型" value={(analysis as any)?.garment_type_detail} />
            </Card>

            {/* Components */}
            <Card title="部件">
              <Row label="領型" value={
                typeof analysis.components?.collar === 'object' && analysis.components.collar !== null
                  ? (analysis.components.collar as any).type ?? (analysis.components.collar as any).description
                  : analysis.components?.collar as string | null
              } />
              <Row label="袖型" value={
                typeof analysis.components?.sleeves === 'object' && analysis.components.sleeves !== null
                  ? `${(analysis.components.sleeves as any).type ?? ''} ${(analysis.components.sleeves as any).length ?? ''}`.trim()
                  : analysis.components?.sleeves as string | null
              } />
              <Row label="難度" value={
                (analysis as any)?.difficulty_estimate
                  ? '★'.repeat((analysis as any).difficulty_estimate)
                  : null
              } />
            </Card>

            {/* Closest patterns */}
            <Card title="推薦 FreeSewing 版型">
              {(analysis.closest_freesewing_patterns ?? []).map((p) => {
                const svgState = patternSvgs[p.design]
                return (
                  <div key={p.design} className="py-2 border-b border-stone-100 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold capitalize text-stone-800">{p.design}</span>
                      <span className="text-xs text-stone-500">{Math.round(p.confidence * 100)}% 符合</span>
                    </div>
                    {(p as any).reasoning && (
                      <p className="text-xs text-stone-400 mb-2">{(p as any).reasoning}</p>
                    )}
                    {/* Preview button */}
                    {!svgState && (
                      <button
                        onClick={() => draftPattern(p.design)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                      >
                        🪡 預覽版型圖樣
                      </button>
                    )}
                    {svgState === 'loading' && (
                      <div className="flex items-center gap-2 text-xs text-stone-400 py-1">
                        <div className="w-3 h-3 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                        打版中…
                      </div>
                    )}
                    {svgState && svgState !== 'loading' && (
                      <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden bg-white">
                        <div
                          className="w-full overflow-auto"
                          dangerouslySetInnerHTML={{ __html: svgState }}
                        />
                        <div className="flex gap-2 p-2 border-t border-stone-100">
                          <a
                            href="/pattern"
                            onClick={() => sessionStorage.setItem('autoSelectDesign', p.design)}
                            className="flex-1 text-center text-xs font-medium py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-700 transition-colors"
                          >
                            完整打版 →
                          </a>
                          <button
                            onClick={() => setPatternSvgs(prev => { const n = { ...prev }; delete n[p.design]; return n })}
                            className="text-xs px-3 py-1.5 text-stone-500 hover:text-stone-700"
                          >
                            收起
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </Card>

            {/* Tags */}
            {analysis.silhouette_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {analysis.silhouette_tags.map(tag => (
                  <span key={tag} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                    {tag.replace(/_/g,' ')}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={() => { setStep('upload'); setPreview(null); setAnalysis(null); setJobStatus('') }}
              className="text-sm text-stone-500 hover:text-stone-700 text-left"
            >
              ← 重新上傳
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-800 font-medium">{value ?? '—'}</span>
    </div>
  )
}
