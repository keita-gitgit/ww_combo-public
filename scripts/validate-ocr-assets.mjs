import { readFile, stat } from 'node:fs/promises'

const files = [
  ['public/ocr/worker.min.js', 50_000],
  ['public/ocr/core/tesseract-core.wasm.js', 2_000_000],
  ['public/ocr/core/tesseract-core-simd.wasm.js', 2_000_000],
  ['public/ocr/core/tesseract-core-lstm.wasm.js', 2_000_000],
  ['public/ocr/core/tesseract-core-simd-lstm.wasm.js', 2_000_000],
  ['public/ocr/lang/jpn.traineddata.gz', 1_000_000],
]

const missing = []
for (const [relativePath, minimumBytes] of files) {
  try {
    const file = await stat(new URL(`../${relativePath}`, import.meta.url))
    if (!file.isFile() || file.size < minimumBytes) {
      missing.push(`${relativePath}（ファイルが小さすぎます）`)
    }
  } catch {
    missing.push(relativePath)
  }
}

if (missing.length > 0) {
  console.error(
    `OCRアセットの検証に失敗しました:\n- ${missing.join(
      '\n- ',
    )}\n\nnpm run sync:ocr-assets を実行してください。`,
  )
  process.exit(1)
}

const sourceChecks = [
  {
    path: 'index.html',
    required: ["script-src 'self' 'wasm-unsafe-eval'"],
    forbidden: [],
  },
  {
    path: 'src/echoScreenshotOcr.ts',
    required: ['workerBlobURL: false', 'decodeImageBlob'],
    forbidden: ['URL.createObjectURL'],
  },
  {
    path: 'src/sonataIconMatcher.ts',
    required: ['decodeImageBlob'],
    forbidden: ['URL.createObjectURL'],
  },
]

const invalidSettings = []
for (const check of sourceChecks) {
  const source = await readFile(new URL(`../${check.path}`, import.meta.url), 'utf8')
  for (const required of check.required) {
    if (!source.includes(required)) {
      invalidSettings.push(`${check.path}: ${required} が設定されていません`)
    }
  }
  for (const forbidden of check.forbidden) {
    if (source.includes(forbidden)) {
      invalidSettings.push(`${check.path}: ${forbidden} はCSPで使用できません`)
    }
  }
}

if (invalidSettings.length > 0) {
  console.error(`OCRブラウザ設定の検証に失敗しました:\n- ${invalidSettings.join('\n- ')}`)
  process.exit(1)
}

console.log(`OCRアセット: ${files.length}件 / ブラウザ設定: ${sourceChecks.length}件`)
