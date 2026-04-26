'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { analysisApi, jobApi } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'
import type { AnalysisJob } from '@/lib/api'

// DEV 用：硬編一個 user_id，正式版改從 auth context 取
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

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

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return

    setPreview(URL.createObjectURL(file))
    setError(null)
    setJobStatus('')

    try {
      // 1. 上傳照片
      setStep('uploading')
      const { photo_id } = await analysisApi.uploadPhoto(DEV_USER_ID, file)

      // 2. 建立非同步 Job
      setStep('analyzing')
      const { job_id } = await jobApi.create(photo_id, DEV_USER_ID)

      // 3. 輪詢直到完成
      const job: AnalysisJob = await jobApi.waitUntilDone(
        job_id,
        (j) => setJobStatus(STATUS_LABEL[j.status] ?? j.status),
      )

      if (job.status === 'failed') {
        throw new Error(job.error ?? '分析失敗，請再試一次')
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
              <Row label="主布" value={analysis.fabric.primary.name} />
              <Row label="成分" value={analysis.fabric.primary.composition_estimate} />
              <Row label="垂墜" value={`${analysis.fabric.primary.drape}/10`} />
              <Row label="厚度" value={`${analysis.fabric.primary.thickness}/10`} />
            </Card>

            {/* Cut */}
            <Card title="剪裁">
              <Row label="輪廓" value={analysis.cut.silhouette} />
              <Row label="鬆量" value={analysis.cut.ease_estimate} />
              <Row label="省道" value={`${analysis.cut.darts} 個`} />
            </Card>

            {/* Closest patterns */}
            <Card title="推薦版型">
              {analysis.closest_freesewing_patterns.map((p) => (
                <div key={p.design} className="flex items-center justify-between py-1">
                  <span className="font-medium capitalize text-stone-800">{p.design}</span>
                  <span className="text-xs text-stone-500">
                    信心度 {Math.round(p.confidence * 100)}%
                  </span>
                </div>
              ))}
            </Card>

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
