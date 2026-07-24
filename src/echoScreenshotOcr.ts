import {
  ECHO_SUBSTAT_DEFINITIONS,
  getEchoMainStatRule,
} from './echoScoring'
import { ECHO_STAT_DEFINITIONS } from './data/echoStats'
import {
  ECHOES,
  ECHO_BY_ID,
  getEchoOcrAliases,
  normalizeEchoOcrText,
} from './echoData'
import { decodeImageBlob } from './imageDecode'
import { matchSonataForEchoScreenshot } from './sonataIconMatcher'
import type { EchoCost, EchoScoreStat, EchoStatId } from './types'

type TesseractModule = typeof import('tesseract.js')
type OcrWorker = Awaited<ReturnType<TesseractModule['createWorker']>>

export interface EchoScreenshotOcrProgress {
  progress: number
  message: string
}

export interface EchoScreenshotOcrResult {
  cost: EchoCost | ''
  echoId: string
  sonataId: string
  mainStatId: EchoStatId | ''
  substats: EchoScoreStat[]
  notices: string[]
  rawText: string
}

export type EchoScreenshotOcrErrorCode =
  | 'image-decode'
  | 'worker-load'
  | 'recognition'
  | 'analysis'

export class EchoScreenshotOcrError extends Error {
  constructor(
    public readonly code: EchoScreenshotOcrErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'EchoScreenshotOcrError'
  }
}

interface TextMatch<T> {
  value: T
  score: number
  margin: number
}

interface ParsedStatLine {
  id: EchoStatId
  value: number
  score: number
  lineIndex: number
}

let workerPromise: Promise<OcrWorker> | undefined
let activeProgress:
  | ((progress: EchoScreenshotOcrProgress) => void)
  | undefined

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeRecognitionText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[％]/g, '%')
    .replace(/[，、]/g, '.')
    .replace(/[―ー−]/g, '-')
}

function compactLabel(value: string): string {
  return normalizeEchoOcrText(
    normalizeRecognitionText(value)
      .replace(/[0-9.,%+×xX]/g, '')
      .replace(/\b(?:COST|HP)\b/gi, (match) => match),
  )
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1]
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current.push(
        Math.min(
          current[rightIndex] + 1,
          previous[rightIndex + 1] + 1,
          previous[rightIndex] +
            (left[leftIndex] === right[rightIndex] ? 0 : 1),
        ),
      )
    }
    previous = current
  }
  return previous[right.length]
}

function editSimilarity(left: string, right: string): number {
  const longest = Math.max(left.length, right.length)
  if (longest === 0) return 1
  return 1 - levenshteinDistance(left, right) / longest
}

function bigramDice(left: string, right: string): number {
  if (left === right) return 1
  if (left.length < 2 || right.length < 2) return 0
  const leftPairs = new Map<string, number>()
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2)
    leftPairs.set(pair, (leftPairs.get(pair) ?? 0) + 1)
  }
  let intersections = 0
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2)
    const count = leftPairs.get(pair) ?? 0
    if (count > 0) {
      intersections += 1
      leftPairs.set(pair, count - 1)
    }
  }
  return (intersections * 2) / (left.length + right.length - 2)
}

function longestCommonSubsequenceRatio(left: string, right: string): number {
  if (!left || !right) return 0
  const row = new Array<number>(right.length + 1).fill(0)
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    let diagonal = 0
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const above = row[rightIndex + 1]
      row[rightIndex + 1] =
        left[leftIndex] === right[rightIndex]
          ? diagonal + 1
          : Math.max(row[rightIndex], above)
      diagonal = above
    }
  }
  return row[right.length] / Math.max(left.length, right.length)
}

function bestWindowEditSimilarity(left: string, right: string): number {
  const shorter = left.length <= right.length ? left : right
  const longer = left.length <= right.length ? right : left
  if (!shorter) return 0
  if (longer.length <= shorter.length + 2) return editSimilarity(shorter, longer)
  let best = 0
  for (let lengthOffset = -2; lengthOffset <= 2; lengthOffset += 1) {
    const windowLength = clamp(
      shorter.length + lengthOffset,
      Math.max(1, shorter.length - 2),
      longer.length,
    )
    for (let start = 0; start <= longer.length - windowLength; start += 1) {
      best = Math.max(
        best,
        editSimilarity(shorter, longer.slice(start, start + windowLength)),
      )
    }
  }
  return best
}

function textSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeEchoOcrText(left)
  const normalizedRight = normalizeEchoOcrText(right)
  if (!normalizedLeft || !normalizedRight) return 0
  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return 0.96
  }
  return clamp(
    bestWindowEditSimilarity(normalizedLeft, normalizedRight) * 0.5 +
      bigramDice(normalizedLeft, normalizedRight) * 0.3 +
      longestCommonSubsequenceRatio(normalizedLeft, normalizedRight) * 0.2,
  )
}

async function makeRecognitionCanvas(source: Blob): Promise<HTMLCanvasElement> {
  const image = await decodeImageBlob(source)
  const landscape = image.width / image.height >= 1.45
  const crop = landscape
    ? {
        left: image.width * 0.685,
        top: image.height * 0.075,
        width: image.width * 0.305,
        height: image.height * 0.6,
      }
    : {
        left: image.width * 0.03,
        top: image.height * 0.06,
        width: image.width * 0.94,
        height: image.height * 0.55,
      }
  const scale = clamp(1080 / crop.width, 2.2, 5.5)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(crop.width * scale)
  canvas.height = Math.round(crop.height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    image.dispose()
    throw new Error('画像解析用Canvasを作成できませんでした')
  }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  try {
    context.drawImage(
      image.source,
      crop.left,
      crop.top,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height,
    )
  } finally {
    image.dispose()
  }

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < pixels.data.length; index += 4) {
    const luminance =
      pixels.data[index] * 0.2126 +
      pixels.data[index + 1] * 0.7152 +
      pixels.data[index + 2] * 0.0722
    const value = clamp((luminance - 90) * 1.42 + 92, 0, 255)
    pixels.data[index] = value
    pixels.data[index + 1] = value
    pixels.data[index + 2] = value
  }
  context.putImageData(pixels, 0, 0)
  return canvas
}

function reportProgress(progress: number, message: string) {
  activeProgress?.({ progress: clamp(progress), message })
}

async function getWorker(): Promise<OcrWorker> {
  if (workerPromise) return workerPromise
  workerPromise = (async () => {
    const tesseract = await import('tesseract.js')
    const worker = await tesseract.createWorker('jpn', tesseract.OEM.LSTM_ONLY, {
      workerPath: new URL('ocr/worker.min.js', document.baseURI).href,
      corePath: new URL('ocr/core/', document.baseURI).href,
      langPath: new URL('ocr/lang/', document.baseURI).href,
      workerBlobURL: false,
      logger: (message) => {
        const progress = Number.isFinite(message.progress) ? message.progress : 0
        if (message.status === 'recognizing text') {
          reportProgress(0.28 + progress * 0.62, `文字を読み取り中 ${Math.round(progress * 100)}%`)
        } else {
          reportProgress(progress * 0.25, '日本語OCRを準備中')
        }
      },
    })
    await worker.setParameters({
      tessedit_pageseg_mode: tesseract.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    })
    return worker
  })().catch((error) => {
    workerPromise = undefined
    throw error
  })
  return workerPromise
}

function extractCost(text: string): EchoCost | '' {
  const normalized = normalizeRecognitionText(text)
  const explicit = normalized.match(/C[O0〇]S[T7]\s*[:：]?\s*([134])/i)
  if (explicit && ['1', '3', '4'].includes(explicit[1])) {
    return Number(explicit[1]) as EchoCost
  }
  const costLine = normalized
    .split(/\r?\n/)
    .find((line) => /C[O0〇]S[T7]/i.test(line))
  const fallback = costLine?.match(/[134]/)
  return fallback ? (Number(fallback[0]) as EchoCost) : ''
}

function bestMatch<T>(
  candidates: Array<{ value: T; score: number }>,
): TextMatch<T> | undefined {
  candidates.sort((left, right) => right.score - left.score)
  const best = candidates[0]
  if (!best) return undefined
  return {
    value: best.value,
    score: best.score,
    margin: best.score - (candidates[1]?.score ?? 0),
  }
}

function matchEcho(
  lines: string[],
  cost: EchoCost | '',
): TextMatch<string> | undefined {
  const costLineIndex = lines.findIndex((line) => /C[O0〇]S[T7]/i.test(line))
  const nameLines = lines
    .slice(0, costLineIndex >= 0 ? costLineIndex : Math.min(lines.length, 5))
    .filter((line) => normalizeEchoOcrText(line).length >= 3)
  const candidates = ECHOES.filter((echo) => !cost || echo.cost === cost).map((echo) => {
    const score = Math.max(
      ...nameLines.flatMap((line) =>
        getEchoOcrAliases(echo).map((alias) => textSimilarity(line, alias)),
      ),
    )
    return { value: echo.id, score }
  })
  return bestMatch(candidates)
}

function numericVariants(raw: string): number[] {
  const normalized = raw.replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return []
  const values = new Set([parsed])
  if (!normalized.includes('.')) {
    values.add(parsed / 10)
    values.add(parsed / 100)
  }
  return [...values]
}

function extractNumericTokens(line: string): string[] {
  return normalizeRecognitionText(line).match(/\d+(?:[.]\d+)?/g) ?? []
}

function closestAllowedValue(
  tokens: string[],
  allowedValues: readonly number[],
): { value: number; score: number } | undefined {
  let best: { value: number; score: number } | undefined
  for (const token of tokens) {
    for (const parsed of numericVariants(token)) {
      for (const allowed of allowedValues) {
        const difference = Math.abs(parsed - allowed)
        const tolerance = Math.max(0.22, allowed * 0.035)
        const score = clamp(1 - difference / tolerance)
        if (!best || score > best.score) best = { value: allowed, score }
      }
    }
  }
  return best?.score ? best : undefined
}

function statLabelScore(line: string, statId: EchoStatId): number {
  const definition = ECHO_STAT_DEFINITIONS.find((stat) => stat.id === statId)
  if (!definition) return 0
  const label = compactLabel(line)
  const aliases = [...definition.aliases]
  if (statId === 'attack' || statId === 'attackPercent') aliases.push('攻撃')
  if (statId === 'defense' || statId === 'defensePercent') aliases.push('防御')
  if (statId === 'energyRegen') aliases.push('共鳴', '効率', '鳴効率')
  if (statId === 'critRate') aliases.push('クリティカル')
  if (statId === 'critDamage') aliases.push('クリダメ')
  return Math.max(...aliases.map((alias) => textSimilarity(label, alias)))
}

function matchMainStat(
  lines: string[],
  cost: EchoCost | '',
): TextMatch<EchoStatId> | undefined {
  if (!cost) return undefined
  const rule = getEchoMainStatRule(cost)
  const candidates = rule.primaryStats.flatMap((stat) =>
    lines.flatMap((line) => {
      const numeric = closestAllowedValue(
        extractNumericTokens(line),
        [stat.valueAtFiveStarLevel25],
      )
      if (!numeric) return []
      const labelScore = statLabelScore(line, stat.id)
      const percentPenalty =
        line.includes('%') && !stat.id.endsWith('Percent') &&
        ![
          'critRate',
          'critDamage',
          'healingBonus',
          'energyRegen',
          'glacioDamage',
          'fusionDamage',
          'electroDamage',
          'aeroDamage',
          'spectroDamage',
          'havocDamage',
        ].includes(stat.id)
          ? 0.25
          : 0
      return [
        {
          value: stat.id,
          score: clamp(numeric.score * 0.58 + labelScore * 0.42 - percentPenalty),
        },
      ]
    }),
  )
  return bestMatch(candidates)
}

function isMainOrFixedLine(line: string, cost: EchoCost | ''): boolean {
  if (!cost) return false
  const rule = getEchoMainStatRule(cost)
  const tokens = extractNumericTokens(line)
  const fixedValue = closestAllowedValue(tokens, [
    rule.fixedStat.valueAtFiveStarLevel25,
  ])
  if (fixedValue?.score === 1 && statLabelScore(line, rule.fixedStat.id) >= 0.3) {
    return true
  }
  return rule.primaryStats.some((stat) => {
    const value = closestAllowedValue(tokens, [stat.valueAtFiveStarLevel25])
    return value?.score === 1 && statLabelScore(line, stat.id) >= 0.34
  })
}

function parseSubstats(
  lines: string[],
  cost: EchoCost | '',
): ParsedStatLine[] {
  const matches: ParsedStatLine[] = []
  lines.forEach((line, lineIndex) => {
    if (isMainOrFixedLine(line, cost)) return
    const tokens = extractNumericTokens(line)
    if (tokens.length === 0) return
    const candidates = ECHO_SUBSTAT_DEFINITIONS.flatMap((definition) => {
      const numeric = closestAllowedValue(tokens, definition.substatValues)
      if (!numeric) return []
      const labelScore = statLabelScore(line, definition.id)
      const percentPenalty =
        line.includes('%') && definition.unit === 'flat' ? 0.32 : 0
      return [
        {
          value: {
            id: definition.id,
            value: numeric.value,
            score: clamp(
              numeric.score * 0.58 + labelScore * 0.42 - percentPenalty,
            ),
            lineIndex,
          },
          score: clamp(
            numeric.score * 0.58 + labelScore * 0.42 - percentPenalty,
          ),
        },
      ]
    })
    const best = bestMatch(candidates)
    if (!best || best.score < 0.55 || (best.margin < 0.035 && best.score < 0.72)) {
      return
    }
    matches.push(best.value)
  })

  const unique = new Map<EchoStatId, ParsedStatLine>()
  matches.forEach((match) => {
    const previous = unique.get(match.id)
    if (!previous || match.score > previous.score) unique.set(match.id, match)
  })
  return [...unique.values()]
    .sort((left, right) => left.lineIndex - right.lineIndex)
    .slice(0, 5)
}

function makeNotices(
  cost: EchoCost | '',
  echoMatch: TextMatch<string> | undefined,
  sonataReliable: boolean,
  mainMatch: TextMatch<EchoStatId> | undefined,
  substats: ParsedStatLine[],
): string[] {
  const notices = []
  if (!cost) notices.push('コストを読み取れませんでした')
  if (!echoMatch || echoMatch.score < 0.34) {
    notices.push('音骸名を特定できませんでした')
  } else if (echoMatch.score < 0.54 || echoMatch.margin < 0.035) {
    notices.push('音骸名の候補を入力しました。名前を確認してください')
  }
  if (echoMatch && !sonataReliable) {
    notices.push('ハーモニーはアイコンの最有力候補です。内容を確認してください')
  }
  if (!mainMatch || mainMatch.score < 0.56) {
    notices.push('メインステータスを特定できませんでした')
  }
  if (substats.length < 5) {
    notices.push(`サブステータスは${substats.length}/5件を読み取りました`)
  }
  return notices
}

/**
 * 鳴潮の音骸詳細スクリーンショットを端末内だけで解析する。
 * 元画像・OCR結果はlocalStorageへ保存しない。
 */
export async function recognizeEchoScreenshot(
  source: Blob,
  onProgress?: (progress: EchoScreenshotOcrProgress) => void,
): Promise<EchoScreenshotOcrResult> {
  activeProgress = onProgress
  try {
    reportProgress(0.02, '画像を準備中')
    let canvas: HTMLCanvasElement
    try {
      canvas = await makeRecognitionCanvas(source)
    } catch (error) {
      throw new EchoScreenshotOcrError(
        'image-decode',
        'スクリーンショットを読み込めませんでした',
        error,
      )
    }
    reportProgress(0.08, '日本語OCRを準備中')
    let worker: OcrWorker
    try {
      worker = await getWorker()
    } catch (error) {
      throw new EchoScreenshotOcrError(
        'worker-load',
        '日本語OCRを準備できませんでした',
        error,
      )
    }
    reportProgress(0.28, '文字を読み取り中')
    let recognition: Awaited<ReturnType<OcrWorker['recognize']>>
    try {
      recognition = await worker.recognize(canvas)
    } catch (error) {
      throw new EchoScreenshotOcrError(
        'recognition',
        'スクリーンショットの文字を認識できませんでした',
        error,
      )
    }
    const rawText = normalizeRecognitionText(recognition.data.text)
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    try {
      reportProgress(0.91, '音骸データと照合中')
      let cost = extractCost(rawText)
      const echoMatch = matchEcho(lines, cost)
      const echoId =
        echoMatch && echoMatch.score >= 0.34 ? echoMatch.value : ''
      const matchedEcho = ECHO_BY_ID.get(echoId)
      cost ||= matchedEcho?.cost ?? ''
      const mainMatch = matchMainStat(lines, cost)
      const parsedSubstats = parseSubstats(lines, cost)
      let sonataId = matchedEcho?.sonataIds[0] ?? ''
      let sonataReliable = matchedEcho?.sonataIds.length === 1

      if (matchedEcho) {
        try {
          const sonata = await matchSonataForEchoScreenshot(source, matchedEcho.id)
          if (sonata) {
            sonataId = sonata.sonataId
            sonataReliable = sonata.reliable
          }
        } catch {
          sonataReliable = false
        }
      }

      const notices = makeNotices(
        cost,
        echoMatch,
        sonataReliable,
        mainMatch,
        parsedSubstats,
      )
      reportProgress(1, '読み取り完了')
      return {
        cost,
        echoId,
        sonataId,
        mainStatId:
          mainMatch && mainMatch.score >= 0.56 ? mainMatch.value : '',
        substats: parsedSubstats.map(({ id, value }) => ({ id, value })),
        notices,
        rawText,
      }
    } catch (error) {
      if (error instanceof EchoScreenshotOcrError) throw error
      throw new EchoScreenshotOcrError(
        'analysis',
        '読み取り結果を音骸データと照合できませんでした',
        error,
      )
    }
  } finally {
    activeProgress = undefined
  }
}
