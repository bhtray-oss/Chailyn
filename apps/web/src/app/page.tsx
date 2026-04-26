import Link from 'next/link'

const features = [
  {
    icon: '📸',
    title: '上傳照片',
    desc: '1–5 張服裝照片，系統自動辨識材質、剪裁與版型元素',
    href: '/analyze',
    cta: '開始分析',
  },
  {
    icon: '📐',
    title: '個人版型',
    desc: '結合你的身材資料，一鍵生成可列印的裁縫紙樣（PDF / SVG）',
    href: '/pattern',
    cta: '瀏覽版型',
  },
  {
    icon: '👤',
    title: '身材檔案',
    desc: '建立多組身材快照，所有版型自動對應你的真實尺寸',
    href: '/profile',
    cta: '建立檔案',
  },
]

export default function Home() {
  return (
    <div className="py-12">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight text-stone-900 mb-4">
          AI 服裝分析 × 個人化打版
        </h1>
        <p className="text-lg text-stone-500 max-w-xl mx-auto">
          上傳一張照片，30 秒內取得材質、剪裁、近似版型三合一分析。
          搭配你的身材資料，直接輸出可實際裁製的紙樣。
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/analyze"
            className="px-6 py-3 bg-stone-900 text-white rounded-lg font-medium hover:bg-stone-700 transition-colors"
          >
            立即上傳照片
          </Link>
          <Link
            href="/pattern"
            className="px-6 py-3 border border-stone-300 text-stone-700 rounded-lg font-medium hover:bg-stone-100 transition-colors"
          >
            瀏覽版型庫
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((f) => (
          <div
            key={f.title}
            className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-3xl">{f.icon}</div>
            <h2 className="font-semibold text-stone-900 text-lg">{f.title}</h2>
            <p className="text-stone-500 text-sm leading-relaxed flex-1">{f.desc}</p>
            <Link
              href={f.href}
              className="text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
            >
              {f.cta} →
            </Link>
          </div>
        ))}
      </div>

      {/* Features Showcase */}
      <div className="mt-24 pt-12 border-t border-stone-200">
        <h2 className="text-2xl font-bold text-center mb-12">為什麼選擇 Chailyn?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          <div className="flex flex-col gap-4">
            <div className="h-10 w-10 bg-amber-100 rounded-lg flex items-center justify-center text-xl text-amber-700">🎨</div>
            <h3 className="font-bold text-lg">精確的打版引擎</h3>
            <p className="text-stone-500 text-sm leading-relaxed">基於 FreeSewing 開源技術，我們提供超過 15 種可無限自訂的基礎版型。</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl text-blue-700">⚡</div>
            <h3 className="font-bold text-lg">AI 視覺辨識</h3>
            <p className="text-stone-500 text-sm leading-relaxed">利用 Claude 3 Vision 模型，快速分析服裝結構，節省手動測量時間。</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center text-xl text-green-700">👗</div>
            <h3 className="font-bold text-lg">1:1 真實尺寸輸出</h3>
            <p className="text-stone-500 text-sm leading-relaxed">所有生成的版型皆可以 SVG 格式匯出，並在 A4/A0 紙張上準確列印。</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-16 grid grid-cols-3 gap-6 text-center">
        {[
          { num: '15+', label: '內建版型' },
          { num: '18', label: '身材測量項目' },
          { num: '< 30 秒', label: 'AI 分析時間' },
        ].map((s) => (
          <div key={s.label} className="py-6">
            <div className="text-2xl font-bold text-stone-900">{s.num}</div>
            <div className="text-sm text-stone-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
