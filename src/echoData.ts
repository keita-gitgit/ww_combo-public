import echoMasterJson from './data/echoes.json'
import sonataIconMasterJson from './data/sonataIcons.json'
import sonataMasterJson from './data/sonataEffects.json'
import type { EchoMasterEntry, SonataEffect, SonataIconEntry } from './types'

interface MasterMetadata<T> {
  schemaVersion: 1
  gameVersion: string
  updatedAt: string
  expectedEntryCount: number
  sourceUrls: string[]
  entries: T[]
}

const echoMaster = echoMasterJson as MasterMetadata<EchoMasterEntry>
const sonataMaster = sonataMasterJson as MasterMetadata<SonataEffect>
const sonataIconMaster = sonataIconMasterJson as MasterMetadata<SonataIconEntry>

export const ECHO_MASTER_METADATA = {
  schemaVersion: echoMaster.schemaVersion,
  gameVersion: echoMaster.gameVersion,
  updatedAt: echoMaster.updatedAt,
  sourceUrls: echoMaster.sourceUrls,
} as const

export const ECHOES: readonly EchoMasterEntry[] = echoMaster.entries
export const SONATA_EFFECTS: readonly SonataEffect[] = sonataMaster.entries
export const SONATA_ICONS: readonly SonataIconEntry[] = sonataIconMaster.entries

export const ECHO_BY_ID = new Map(ECHOES.map((echo) => [echo.id, echo]))
export const SONATA_BY_ID = new Map(SONATA_EFFECTS.map((sonata) => [sonata.id, sonata]))
export const SONATA_ICON_BY_ID = new Map(
  SONATA_ICONS.map((icon) => [icon.sonataId, icon]),
)

/**
 * OCR結果の比較用。空白・中黒・括弧・一部の見た目が近い記号を除去し、
 * 半角/全角の差を吸収する。
 */
export function normalizeEchoOcrText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[・･·\s()[\]（）「」『』【】]/g, '')
    .replace(/[ー―−]/g, 'ー')
    .toLocaleLowerCase('ja-JP')
}

export function getEchoOcrAliases(echo: EchoMasterEntry): string[] {
  const aliases = new Set([echo.name, ...(echo.aliases ?? [])])
  if (echo.name.startsWith('響き渡る共鳴・')) {
    aliases.add(echo.name.replace('響き渡る共鳴・', ''))
  }
  return [...aliases]
}

const ECHO_OCR_NAME_INDEX = new Map(
  ECHOES.flatMap((echo) =>
    getEchoOcrAliases(echo).map((alias) => [normalizeEchoOcrText(alias), echo] as const),
  ),
)

export function findEchoByOcrName(value: string): EchoMasterEntry | undefined {
  return ECHO_OCR_NAME_INDEX.get(normalizeEchoOcrText(value))
}
