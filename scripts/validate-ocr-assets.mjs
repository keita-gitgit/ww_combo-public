import { stat } from 'node:fs/promises'

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

console.log(`OCRアセット: ${files.length}件`)
