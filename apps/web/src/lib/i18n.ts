export type Lang = 'zh' | 'en'

const zh = {
  // ── Nav ────────────────────────────────────────────────────────────────────
  'nav.analyze':         '分析照片',
  'nav.history':         '分析歷史',
  'nav.recommendations': '設計建議',
  'nav.search':          '搜尋版型',
  'nav.pattern':         '版型',
  'nav.wardrobe':        '衣櫃',
  'nav.profile':         '身材檔案',

  // ── Analyze page ───────────────────────────────────────────────────────────
  'analyze.title':         '服裝照片分析',
  'analyze.subtitle':      '上傳 1 張服裝照片，AI 將自動識別材質、剪裁與推薦版型',
  'analyze.drop':          '拖拉照片到此，或點擊選擇',
  'analyze.release':       '放開以上傳',
  'analyze.hint':          '支援 JPG、PNG、WebP，最大 10MB',
  'analyze.uploading':     '照片上傳中…',
  'analyze.analyzing':     'Claude 正在分析照片…',
  'analyze.saved':         '照片與分析已儲存至歷史',
  'analyze.viewHistory':   '查看歷史紀錄 →',
  'analyze.clear':         '清除',
  'analyze.uploadNew':     '📸 上傳新服裝照片',
  'analyze.uploadNewTitle':'上傳新服裝照片',
  'analyze.cancel':        '✕ 取消',
  'analyze.goRecs':        '✨ 前往設計建議頁面 →',

  // ── Analysis status labels ─────────────────────────────────────────────────
  'status.pending': '排隊等待中…',
  'status.running': 'Claude 正在分析照片…',
  'status.done':    '分析完成',
  'status.failed':  '分析失敗',

  // ── Error messages ─────────────────────────────────────────────────────────
  'error.serverDown':    '無法連線到伺服器（API :8000 未啟動？），請確認後端服務正在執行。',
  'error.uploadFailed':  '上傳失敗：',
  'error.billing':       'Anthropic 帳戶餘額不足，請至 console.anthropic.com 加值',
  'error.imageQuality':  '圖片格式不支援或品質太低，請換一張清晰的服裝照片',
  'error.analysisFailed':'分析失敗，請再試一次',
  'error.timeout':       '分析逾時，請稍後再試',
  'error.recsFailed':    '推薦生成失敗，請再試一次',
  'error.deleteFailed':  '刪除失敗：',
  'error.deleteConfirm': '確定要刪除這筆分析記錄？',

  // ── Pattern preview panel ──────────────────────────────────────────────────
  'preview.title':      '版型圖樣',
  'preview.fullPieces': '完整裁片',
  'preview.generating': '正在生成版型…',

  // ── Cards ──────────────────────────────────────────────────────────────────
  'card.fabric':           '布料',
  'card.cut':              '剪裁版型',
  'card.components':       '部件',
  'card.patterns':         '推薦 FreeSewing 版型',

  // ── Row labels ─────────────────────────────────────────────────────────────
  'row.primary':           '主布',
  'row.composition':       '成分',
  'row.weight':            '重量',
  'row.drape':             '垂墜',
  'row.thickness':         '厚度',
  'row.silhouette':        '廓形',
  'row.ease':              '鬆量',
  'row.waist':             '腰部',
  'row.type':              '類型',
  'row.collar':            '領型',
  'row.sleeve':            '袖型',
  'row.difficulty':        '難度',

  // ── Pattern card ───────────────────────────────────────────────────────────
  'pattern.match':         '% 符合',
  'pattern.preview':       '🪡 預覽版型圖樣',
  'pattern.drafting':      '打版中…',
  'pattern.previewed':     '✓ 已預覽',
  'pattern.fullDraft':     '完整打版 →',
  'pattern.close':         '✕ 關閉',
  'pattern.reset':         '重置',
  'pattern.others':        '← 其他推薦',
  'pattern.seam':          '縫份',
  'pattern.generated':     '使用 FreeSewing v4 生成',

  // ── Recs CTA (inline on analyze page) ─────────────────────────────────────
  'recs.cta.title':        '為你量身推薦',
  'recs.cta.subtitle':     '結合 AI 分析與你的身材，產生版型調整、布料、配色、採購清單與製作預估',
  'recs.cta.btn':          '✨ 立即生成個人化推薦',
  'recs.cta.generating':   'Claude 正在生成推薦…',
  'recs.cta.regen':        '↻ 重新生成',

  // ── Recommendations page ───────────────────────────────────────────────────
  'rec.title':           '設計建議',
  'rec.subtitle':        '結合 AI 分析與你的身材，產生版型調整、布料、配色、採購清單與製作預估等個人化推薦',
  'rec.picker':          '選擇分析記錄',
  'rec.generated':       '已生成',
  'rec.summary':         '分析結果摘要',
  'rec.generateBtn':     '✨ 立即生成個人化推薦',
  'rec.regenBtn':        '↻ 重新生成推薦',
  'rec.generating':      'Claude 正在生成推薦…',
  'rec.heading':         '為你量身推薦',
  'rec.byAI':            '· 由 Claude AI 根據分析結果與你的身材生成',
  'rec.cached':          '推薦結果已快取，下次開啟本頁自動載入',
  'rec.analyzeNew':      '分析新照片 →',
  'rec.noHistory':       '尚無分析記錄',
  'rec.goAnalyze':       '前往分析照片 →',
  'rec.emptyHint':       '點擊上方按鈕，Claude 將根據你的身材與分析結果',
  'rec.emptyHint2':      '產生版型調整、布料建議、配色方案、採購清單與製作預估',
  // Card titles
  'rec.card.adj':        '版型調整',
  'rec.card.fabric':     '布料建議',
  'rec.card.color':      '色彩方案',
  'rec.card.style':      '風格延伸',
  'rec.card.shopping':   '採購清單',
  'rec.card.production': '製作預估',
  'rec.card.mood':       '靈感版型',
  // Fabric labels
  'rec.fabric.rec':      '推薦',
  'rec.fabric.alt':      '替代',
  'rec.fabric.avoid':    '避免',
  // Shopping table
  'rec.shop.material':   '材料',
  'rec.shop.qty':        '數量',
  'rec.shop.price':      'NT$',
  'rec.shop.total':      '材料合計',
  // Production
  'rec.prod.difficulty': '難度',
  'rec.prod.time':       '製作時間',
  'rec.prod.hours':      '小時',
  'rec.prod.diy':        'DIY 材料成本',
  'rec.prod.retail':     '市售參考價',
  'rec.prod.retailShort':'市售',
  'rec.prod.save':       '省',

  // ── History page ───────────────────────────────────────────────────────────
  'hist.title':          '分析歷史',
  'hist.subtitle':       '所有服裝照片的 AI 分析記錄，自動儲存',
  'hist.newAnalysis':    '+ 新增分析',
  'hist.loading':        '載入中…',
  'hist.empty':          '尚無分析記錄。',
  'hist.emptyHint':      '上傳服裝照片後，結果會自動儲存在這裡',
  'hist.startAnalysis':  '開始分析',
  'hist.goAnalyze':      '前往分析照片 →',
  'hist.expand':         '查看詳情',
  'hist.collapse':       '收起',
  'hist.delete':         '刪除',
  'hist.deleting':       '刪除中…',
  'hist.fabric':         '布料',
  'hist.silhouette':     '廓形',
  'hist.patterns':       '推薦版型',
  'hist.difficulty':     '難度',
  'hist.previewPattern': '🪡 預覽版型',
  'hist.drafting':       '打版中…',
  'hist.unknownFabric':  '未知布料',

  // ── Home page ──────────────────────────────────────────────────────────────
  'home.hero.title':   'AI 服裝分析 × 個人化打版',
  'home.hero.desc':    '上傳一張照片，30 秒內取得材質、剪裁、近似版型三合一分析。搭配你的身材資料，直接輸出可實際裁製的紙樣。',
  'home.hero.upload':  '立即上傳照片',
  'home.hero.browse':  '瀏覽版型庫',
  // Feature cards
  'home.f1.title': '上傳照片',
  'home.f1.desc':  '1–5 張服裝照片，系統自動辨識材質、剪裁與版型元素',
  'home.f1.cta':   '開始分析',
  'home.f2.title': '個人版型',
  'home.f2.desc':  '結合你的身材資料，一鍵生成可列印的裁縫紙樣（PDF / SVG）',
  'home.f2.cta':   '瀏覽版型',
  'home.f3.title': '身材檔案',
  'home.f3.desc':  '建立多組身材快照，所有版型自動對應你的真實尺寸',
  'home.f3.cta':   '建立檔案',
  // Why section
  'home.why':            '為什麼選擇 Chailyn?',
  'home.engine.title':   '精確的打版引擎',
  'home.engine.desc':    '基於 FreeSewing 開源技術，提供超過 15 種可無限自訂的基礎版型。',
  'home.ai.title':       'AI 視覺辨識',
  'home.ai.desc':        '利用 Claude Vision 模型，快速分析服裝結構，節省手動測量時間。',
  'home.output.title':   '1:1 真實尺寸輸出',
  'home.output.desc':    '所有生成的版型皆可以 SVG 格式匯出，在 A4/A0 紙張上準確列印。',
  // Stats
  'home.stat.patterns':     '內建版型',
  'home.stat.measurements': '身材測量項目',
  'home.stat.time':         'AI 分析時間',

  // ── Misc ───────────────────────────────────────────────────────────────────
  'misc.garment':        '服裝',
}

const en: typeof zh = {
  // ── Nav ────────────────────────────────────────────────────────────────────
  'nav.analyze':         'Analyze',
  'nav.history':         'History',
  'nav.recommendations': 'Design Tips',
  'nav.search':          'Search Patterns',
  'nav.pattern':         'Pattern',
  'nav.wardrobe':        'Wardrobe',
  'nav.profile':         'Body Profile',

  // ── Analyze page ───────────────────────────────────────────────────────────
  'analyze.title':         'Garment Analysis',
  'analyze.subtitle':      'Upload a garment photo — AI identifies fabric, cut & recommended patterns',
  'analyze.drop':          'Drop photo here, or click to select',
  'analyze.release':       'Release to upload',
  'analyze.hint':          'Supports JPG, PNG, WebP. Max 10MB',
  'analyze.uploading':     'Uploading photo…',
  'analyze.analyzing':     'Claude is analyzing your photo…',
  'analyze.saved':         'Photo & analysis saved to history',
  'analyze.viewHistory':   'View history →',
  'analyze.clear':         'Clear',
  'analyze.uploadNew':     '📸 Upload New Photo',
  'analyze.uploadNewTitle':'Upload New Garment Photo',
  'analyze.cancel':        '✕ Cancel',
  'analyze.goRecs':        '✨ Go to Design Tips →',

  // ── Analysis status labels ─────────────────────────────────────────────────
  'status.pending': 'Queuing…',
  'status.running': 'Claude is analyzing your photo…',
  'status.done':    'Analysis complete',
  'status.failed':  'Analysis failed',

  // ── Error messages ─────────────────────────────────────────────────────────
  'error.serverDown':    'Cannot connect to server (API :8000 not running?). Please ensure the backend is running.',
  'error.uploadFailed':  'Upload failed: ',
  'error.billing':       'Anthropic account balance insufficient. Please top up at console.anthropic.com',
  'error.imageQuality':  'Image format not supported or quality too low. Please use a clear garment photo.',
  'error.analysisFailed':'Analysis failed, please try again',
  'error.timeout':       'Analysis timed out, please try again later',
  'error.recsFailed':    'Failed to generate recommendations, please try again',
  'error.deleteFailed':  'Delete failed: ',
  'error.deleteConfirm': 'Delete this analysis record?',

  // ── Pattern preview panel ──────────────────────────────────────────────────
  'preview.title':      'Pattern',
  'preview.fullPieces': 'Full pieces',
  'preview.generating': 'Generating pattern…',

  // ── Cards ──────────────────────────────────────────────────────────────────
  'card.fabric':           'Fabric',
  'card.cut':              'Cut & Pattern',
  'card.components':       'Components',
  'card.patterns':         'Recommended FreeSewing Patterns',

  // ── Row labels ─────────────────────────────────────────────────────────────
  'row.primary':           'Primary',
  'row.composition':       'Composition',
  'row.weight':            'Weight',
  'row.drape':             'Drape',
  'row.thickness':         'Thickness',
  'row.silhouette':        'Silhouette',
  'row.ease':              'Ease',
  'row.waist':             'Waist',
  'row.type':              'Type',
  'row.collar':            'Collar',
  'row.sleeve':            'Sleeve',
  'row.difficulty':        'Difficulty',

  // ── Pattern card ───────────────────────────────────────────────────────────
  'pattern.match':         '% match',
  'pattern.preview':       '🪡 Preview Pattern',
  'pattern.drafting':      'Drafting…',
  'pattern.previewed':     '✓ Previewed',
  'pattern.fullDraft':     'Full Draft →',
  'pattern.close':         '✕ Close',
  'pattern.reset':         'Reset',
  'pattern.others':        '← Other Picks',
  'pattern.seam':          'Seam allowance',
  'pattern.generated':     'Generated with FreeSewing v4',

  // ── Recs CTA (inline on analyze page) ─────────────────────────────────────
  'recs.cta.title':        'Personalized Recommendations',
  'recs.cta.subtitle':     'Combining AI analysis with your measurements for pattern adjustments, fabric, colors, shopping list & cost estimate',
  'recs.cta.btn':          '✨ Generate My Recommendations',
  'recs.cta.generating':   'Claude is generating recommendations…',
  'recs.cta.regen':        '↻ Regenerate',

  // ── Recommendations page ───────────────────────────────────────────────────
  'rec.title':           'Design Tips',
  'rec.subtitle':        'AI-powered personalized recommendations based on your analysis and body measurements',
  'rec.picker':          'Select Analysis',
  'rec.generated':       'Generated',
  'rec.summary':         'Analysis Summary',
  'rec.generateBtn':     '✨ Generate Personalized Recommendations',
  'rec.regenBtn':        '↻ Regenerate',
  'rec.generating':      'Claude is generating recommendations…',
  'rec.heading':         'Your Personalized Recommendations',
  'rec.byAI':            '· Generated by Claude AI from your analysis & measurements',
  'rec.cached':          'Results cached — loads automatically next time',
  'rec.analyzeNew':      'Analyze New Photo →',
  'rec.noHistory':       'No analysis records yet.',
  'rec.goAnalyze':       'Go Analyze a Photo →',
  'rec.emptyHint':       'Click the button above — Claude will use your measurements & analysis',
  'rec.emptyHint2':      'to generate pattern adjustments, fabric suggestions, colors, shopping list & cost estimate',
  // Card titles
  'rec.card.adj':        'Pattern Adjustments',
  'rec.card.fabric':     'Fabric Suggestions',
  'rec.card.color':      'Color Palette',
  'rec.card.style':      'Style Variants',
  'rec.card.shopping':   'Shopping List',
  'rec.card.production': 'Production Estimate',
  'rec.card.mood':       'Inspiration Patterns',
  // Fabric labels
  'rec.fabric.rec':      'Recommended',
  'rec.fabric.alt':      'Alternative',
  'rec.fabric.avoid':    'Avoid',
  // Shopping table
  'rec.shop.material':   'Material',
  'rec.shop.qty':        'Qty',
  'rec.shop.price':      'NT$',
  'rec.shop.total':      'Total',
  // Production
  'rec.prod.difficulty': 'Difficulty',
  'rec.prod.time':       'Time',
  'rec.prod.hours':      'hrs',
  'rec.prod.diy':        'DIY Material Cost',
  'rec.prod.retail':     'Retail Reference',
  'rec.prod.retailShort':'Retail',
  'rec.prod.save':       'Save',

  // ── History page ───────────────────────────────────────────────────────────
  'hist.title':          'Analysis History',
  'hist.subtitle':       'All garment photo analyses, auto-saved',
  'hist.newAnalysis':    '+ New Analysis',
  'hist.loading':        'Loading…',
  'hist.empty':          'No analysis records yet.',
  'hist.emptyHint':      'Upload a garment photo and results will be saved here automatically',
  'hist.startAnalysis':  'Start Analyzing',
  'hist.goAnalyze':      'Go Analyze a Photo →',
  'hist.expand':         'Expand',
  'hist.collapse':       'Collapse',
  'hist.delete':         'Delete',
  'hist.deleting':       'Deleting…',
  'hist.fabric':         'Fabric',
  'hist.silhouette':     'Silhouette',
  'hist.patterns':       'Recommended Patterns',
  'hist.difficulty':     'Difficulty',
  'hist.previewPattern': '🪡 Preview Pattern',
  'hist.drafting':       'Drafting…',
  'hist.unknownFabric':  'Unknown fabric',

  // ── Home page ──────────────────────────────────────────────────────────────
  'home.hero.title':   'AI Garment Analysis × Personalized Patternmaking',
  'home.hero.desc':    'Upload a photo and get a 3-in-1 analysis of fabric, cut & matching patterns in 30 seconds. Pair with your body measurements to output print-ready sewing patterns.',
  'home.hero.upload':  'Upload a Photo',
  'home.hero.browse':  'Browse Patterns',
  // Feature cards
  'home.f1.title': 'Upload Photo',
  'home.f1.desc':  '1–5 garment photos — AI automatically identifies fabric, cut & pattern elements',
  'home.f1.cta':   'Start Analyzing',
  'home.f2.title': 'Personal Patterns',
  'home.f2.desc':  'Combine with your measurements to generate print-ready sewing patterns (PDF / SVG)',
  'home.f2.cta':   'Browse Patterns',
  'home.f3.title': 'Body Profile',
  'home.f3.desc':  'Create multiple body snapshots — all patterns automatically adapt to your real dimensions',
  'home.f3.cta':   'Create Profile',
  // Why section
  'home.why':            'Why Chailyn?',
  'home.engine.title':   'Precision Pattern Engine',
  'home.engine.desc':    'Built on FreeSewing open-source technology, offering 15+ fully customizable base patterns.',
  'home.ai.title':       'AI Visual Recognition',
  'home.ai.desc':        'Powered by Claude Vision to rapidly analyze garment structure and save manual measurement time.',
  'home.output.title':   '1:1 True-to-Size Output',
  'home.output.desc':    'Every generated pattern exports as SVG and prints accurately on A4/A0 paper.',
  // Stats
  'home.stat.patterns':     'Built-in Patterns',
  'home.stat.measurements': 'Measurement Points',
  'home.stat.time':         'AI Analysis Time',

  // ── Misc ───────────────────────────────────────────────────────────────────
  'misc.garment':        'Garment',
}

export const dict: Record<Lang, typeof zh> = { zh, en }

export function createT(lang: Lang) {
  return (key: keyof typeof zh): string => dict[lang][key] ?? key
}
