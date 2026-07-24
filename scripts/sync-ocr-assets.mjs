import { copyFile, mkdir } from 'node:fs/promises'

const projectRoot = new URL('../', import.meta.url)
const outputRoot = new URL('../public/ocr/', import.meta.url)

const files = [
  {
    source: 'node_modules/tesseract.js/dist/worker.min.js',
    output: 'worker.min.js',
  },
  {
    source: 'node_modules/tesseract.js-core/tesseract-core.wasm.js',
    output: 'core/tesseract-core.wasm.js',
  },
  {
    source: 'node_modules/tesseract.js-core/tesseract-core-simd.wasm.js',
    output: 'core/tesseract-core-simd.wasm.js',
  },
  {
    source: 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
    output: 'core/tesseract-core-lstm.wasm.js',
  },
  {
    source: 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
    output: 'core/tesseract-core-simd-lstm.wasm.js',
  },
  {
    source: 'node_modules/@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz',
    output: 'lang/jpn.traineddata.gz',
  },
]

for (const file of files) {
  const outputUrl = new URL(file.output, outputRoot)
  await mkdir(new URL('./', outputUrl), { recursive: true })
  await copyFile(new URL(file.source, projectRoot), outputUrl)
  console.log(`OCR asset: ${file.output}`)
}
