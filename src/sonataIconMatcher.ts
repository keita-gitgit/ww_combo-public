import { ECHO_BY_ID, SONATA_BY_ID, SONATA_ICON_BY_ID } from './echoData'

export interface SonataIconMatchAlternative {
  sonataId: string
  name: string
  score: number
}

export interface SonataIconMatch {
  sonataId: string
  name: string
  confidence: number
  reliable: boolean
  method: 'single-candidate' | 'template'
  alternatives: SonataIconMatchAlternative[]
}

const referenceImageCache = new Map<string, Promise<HTMLImageElement>>()

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`画像を読み込めませんでした: ${url}`))
    image.src = url
  })
}

async function loadScreenshot(source: Blob | HTMLImageElement): Promise<HTMLImageElement> {
  if (source instanceof HTMLImageElement) return source
  const objectUrl = URL.createObjectURL(source)
  try {
    return await loadImage(objectUrl)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function getReferenceImage(sonataId: string): Promise<HTMLImageElement> {
  const icon = SONATA_ICON_BY_ID.get(sonataId)
  if (!icon) return Promise.reject(new Error(`未登録のハーモニーです: ${sonataId}`))
  const url = new URL(icon.iconPath, document.baseURI).href
  const cached = referenceImageCache.get(url)
  if (cached) return cached
  const request = loadImage(url)
  referenceImageCache.set(url, request)
  return request
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function compareTemplateAt(
  screenshot: ImageData,
  template: ImageData,
  left: number,
  top: number,
): number {
  let weightSum = 0
  let referenceLuminanceSum = 0
  let targetLuminanceSum = 0
  let colorError = 0

  for (let y = 0; y < template.height; y += 1) {
    for (let x = 0; x < template.width; x += 1) {
      const templateIndex = (y * template.width + x) * 4
      const alpha = template.data[templateIndex + 3] / 255
      if (alpha < 0.18) continue
      const screenshotIndex = ((top + y) * screenshot.width + left + x) * 4
      const referenceRed = template.data[templateIndex]
      const referenceGreen = template.data[templateIndex + 1]
      const referenceBlue = template.data[templateIndex + 2]
      const targetRed = screenshot.data[screenshotIndex]
      const targetGreen = screenshot.data[screenshotIndex + 1]
      const targetBlue = screenshot.data[screenshotIndex + 2]
      const referenceLuminance =
        referenceRed * 0.299 + referenceGreen * 0.587 + referenceBlue * 0.114
      const targetLuminance =
        targetRed * 0.299 + targetGreen * 0.587 + targetBlue * 0.114
      weightSum += alpha
      referenceLuminanceSum += referenceLuminance * alpha
      targetLuminanceSum += targetLuminance * alpha
      colorError +=
        (Math.abs(referenceRed - referenceGreen - (targetRed - targetGreen)) +
          Math.abs(referenceBlue - referenceGreen - (targetBlue - targetGreen))) *
        alpha
    }
  }

  if (weightSum === 0) return 0
  const referenceMean = referenceLuminanceSum / weightSum
  const targetMean = targetLuminanceSum / weightSum
  let covariance = 0
  let referenceVariance = 0
  let targetVariance = 0

  for (let y = 0; y < template.height; y += 1) {
    for (let x = 0; x < template.width; x += 1) {
      const templateIndex = (y * template.width + x) * 4
      const alpha = template.data[templateIndex + 3] / 255
      if (alpha < 0.18) continue
      const screenshotIndex = ((top + y) * screenshot.width + left + x) * 4
      const referenceLuminance =
        template.data[templateIndex] * 0.299 +
        template.data[templateIndex + 1] * 0.587 +
        template.data[templateIndex + 2] * 0.114
      const targetLuminance =
        screenshot.data[screenshotIndex] * 0.299 +
        screenshot.data[screenshotIndex + 1] * 0.587 +
        screenshot.data[screenshotIndex + 2] * 0.114
      const referenceDelta = referenceLuminance - referenceMean
      const targetDelta = targetLuminance - targetMean
      covariance += referenceDelta * targetDelta * alpha
      referenceVariance += referenceDelta * referenceDelta * alpha
      targetVariance += targetDelta * targetDelta * alpha
    }
  }

  const luminanceCorrelation =
    referenceVariance > 0 && targetVariance > 0
      ? covariance / Math.sqrt(referenceVariance * targetVariance)
      : -1
  const luminanceScore = (clamp(luminanceCorrelation, -1, 1) + 1) / 2
  const colorScore = 1 - clamp(colorError / (weightSum * 510))
  return luminanceScore * 0.82 + colorScore * 0.18
}

async function bestTemplateScore(
  screenshot: ImageData,
  reference: HTMLImageElement,
): Promise<number> {
  const minSize = Math.max(9, Math.round(screenshot.height * 0.025))
  const maxSize = Math.max(minSize, Math.round(screenshot.height * 0.05))
  const region = {
    left: Math.round(screenshot.width * 0.81),
    top: Math.round(screenshot.height * 0.09),
    right: Math.round(screenshot.width * 0.985),
    bottom: Math.round(screenshot.height * 0.235),
  }
  let bestScore = 0

  for (let size = minSize; size <= maxSize; size += 2) {
    const templateCanvas = makeCanvas(size, size)
    const templateContext = templateCanvas.getContext('2d', {
      willReadFrequently: true,
    })
    if (!templateContext) throw new Error('アイコン比較用Canvasを作成できません')
    templateContext.drawImage(reference, 0, 0, size, size)
    const template = templateContext.getImageData(0, 0, size, size)

    for (let top = region.top; top <= region.bottom - size; top += 1) {
      for (let left = region.left; left <= region.right - size; left += 1) {
        bestScore = Math.max(
          bestScore,
          compareTemplateAt(screenshot, template, left, top),
        )
      }
    }
  }

  return bestScore
}

/**
 * 音骸名から絞り込んだハーモニー候補と、スクリーンショット右上の
 * ハーモニーアイコンを照合する。画像はブラウザ内だけで処理する。
 */
export async function matchSonataIconFromScreenshot(
  source: Blob | HTMLImageElement,
  candidateSonataIds: readonly string[],
): Promise<SonataIconMatch | undefined> {
  const candidateIds = [...new Set(candidateSonataIds)].filter(
    (sonataId) => SONATA_BY_ID.has(sonataId) && SONATA_ICON_BY_ID.has(sonataId),
  )
  if (candidateIds.length === 0) return undefined

  if (candidateIds.length === 1) {
    const sonataId = candidateIds[0]
    return {
      sonataId,
      name: SONATA_BY_ID.get(sonataId)?.name ?? sonataId,
      confidence: 1,
      reliable: true,
      method: 'single-candidate',
      alternatives: [],
    }
  }

  const screenshotImage = await loadScreenshot(source)
  const workingScale = Math.min(1, 960 / screenshotImage.naturalWidth)
  const canvas = makeCanvas(
    Math.round(screenshotImage.naturalWidth * workingScale),
    Math.round(screenshotImage.naturalHeight * workingScale),
  )
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('スクリーンショット解析用Canvasを作成できません')
  context.drawImage(screenshotImage, 0, 0, canvas.width, canvas.height)
  const screenshot = context.getImageData(0, 0, canvas.width, canvas.height)

  const scored = await Promise.all(
    candidateIds.map(async (sonataId) => ({
      sonataId,
      name: SONATA_BY_ID.get(sonataId)?.name ?? sonataId,
      score: await bestTemplateScore(
        screenshot,
        await getReferenceImage(sonataId),
      ),
    })),
  )
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  const margin = best.score - (scored[1]?.score ?? 0)
  const confidence = clamp(best.score * 0.72 + margin * 2.8)

  return {
    sonataId: best.sonataId,
    name: best.name,
    confidence,
    reliable: best.score >= 0.58 && margin >= 0.025,
    method: 'template',
    alternatives: scored.slice(1, 4),
  }
}

/**
 * OCRで確定した音骸IDを使い、その音骸に設定可能なハーモニーだけを照合する。
 */
export async function matchSonataForEchoScreenshot(
  source: Blob | HTMLImageElement,
  echoId: string,
): Promise<SonataIconMatch | undefined> {
  const echo = ECHO_BY_ID.get(echoId)
  if (!echo) return undefined
  return matchSonataIconFromScreenshot(source, echo.sonataIds)
}
