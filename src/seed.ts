import type { AppData, Character, CharacterAction, ActionKind } from './types'
import { newId } from './types'
import { ROSTER, iconFileName, type RosterEntry } from './characterData'
import {
  getCharacterActionTemplate,
  getLegacyCharacterActionTemplate,
  SIMPLE_ACTION_TEMPLATE,
  type ActionTemplate,
} from './characterActions'

// 新規キャラ作成時に付与する共通アクションのテンプレート
export const COMMON_ACTION_TEMPLATE: Array<{ name: string; kind: ActionKind }> = [
  ...SIMPLE_ACTION_TEMPLATE.map(({ name, kind }) => ({ name, kind })),
]

export function makeCommonActions(): CharacterAction[] {
  return COMMON_ACTION_TEMPLATE.map((t) => ({ id: newId(), ...t }))
}

// PS5のデフォルトキー配置に基づく技名→ボタンの対応表。
// ゲーム内でキー配置を変えている場合は設定画面から編集できる
export const DEFAULT_BUTTON_MAP: Record<string, string> = {
  通常攻撃: '□',
  共鳴スキル: '△',
  重撃: '□長押し',
  空中攻撃: '空中で□',
  共鳴解放: 'R1',
  協和破壊: '□',
  音骸: 'L1+□',
  変奏: '十字キー',
  終奏: '十字キー',
  回避: '○',
  ジャンプ: '×',
  落下攻撃: '空中で□',
}

export function resolveButtonForAction(
  actionName: string,
  buttonMap: Record<string, string>,
): string | undefined {
  if (buttonMap[actionName]) return buttonMap[actionName]
  if (/通常(?:攻撃)?/.test(actionName)) return buttonMap.通常攻撃 ?? buttonMap.通常1
  if (/重撃/.test(actionName)) return buttonMap.重撃
  if (/スキル/.test(actionName)) return buttonMap.共鳴スキル ?? buttonMap.スキル
  if (/解放/.test(actionName)) return buttonMap.共鳴解放 ?? buttonMap.解放
  if (/^音骸/.test(actionName)) return buttonMap.音骸
  if (/^変奏/.test(actionName)) return buttonMap.変奏
  if (/^終奏/.test(actionName)) return buttonMap.終奏
  if (/回避/.test(actionName)) return buttonMap.回避
  if (/空中/.test(actionName)) return buttonMap.空中攻撃 ?? buttonMap.落下
  if (/(落下|崩れ落ちる)/.test(actionName)) return buttonMap.落下攻撃 ?? buttonMap.落下
  if (actionName === 'ジャンプ') return buttonMap.ジャンプ
  return undefined
}

function makeRosterActions(name: string): CharacterAction[] {
  const template = getCharacterActionTemplate(name)
  return (template.length > 0 ? template : COMMON_ACTION_TEMPLATE).map((action) => ({
    id: newId(),
    ...action,
  }))
}

export function makeCharacterFromRoster(entry: RosterEntry): Character {
  return {
    id: newId(),
    name: entry.name,
    element: entry.element,
    weapon: entry.weapon,
    rarity: entry.rarity,
    image: iconFileName(entry.icon),
    actions: makeRosterActions(entry.name),
  }
}

const LEGACY_COMMON_ACTION_NAMES = new Map<string, string>([
  ['通常攻撃', '通常1'],
  ['通常攻撃1', '通常1'],
  ['通常攻撃2', '通常2'],
  ['通常攻撃3', '通常3'],
  ['通常攻撃4', '通常4'],
  ['通常攻撃5', '通常5'],
  ['通常', '通常1'],
  ['強化通常', '通常1'],
  ['スキル', '共鳴スキル'],
  ['強化スキル', '共鳴スキル'],
  ['重撃', '重撃'],
  ['空中', '空中攻撃'],
  ['回避反撃', '回避'],
  ['解放', '共鳴解放'],
  ['解放2段目', '共鳴解放'],
  ['音骸', '音骸'],
  ['変奏', '変奏'],
  ['終奏', '終奏'],
  ['回避', '回避'],
  ['ジャンプ', 'ジャンプ'],
  ['落下', '落下攻撃'],
])

function canonicalNameForLegacyAction(action: ActionTemplate): string {
  const detailedName = action.officialName ?? action.name

  if (action.kind === 'liberation') return '共鳴解放'
  if (action.kind === 'echo') return '音骸'
  if (action.kind === 'concerto') return detailedName.startsWith('終奏') ? '終奏' : '変奏'
  if (action.kind === 'move') {
    if (detailedName.includes('ジャンプ')) return 'ジャンプ'
    if (detailedName.includes('回避')) return '回避'
    return '落下攻撃'
  }
  if (detailedName.includes('回避')) return '回避'
  if (/(空中|崩れ落ち)/.test(detailedName)) return '空中攻撃'
  if (detailedName.includes('重撃')) return '重撃'
  if (/(通常|照準)/.test(detailedName) || action.kind === 'normal') {
    const sequence = detailedName.replace(/通常攻撃/g, '通常').match(/通常.*?([1-5])$/)?.[1]
    return `通常${sequence ?? '1'}`
  }
  return '共鳴スキル'
}

function makeLegacyActionNameMap(characterName: string): Map<string, string> {
  const names = new Map(LEGACY_COMMON_ACTION_NAMES)
  for (const action of getLegacyCharacterActionTemplate(characterName)) {
    const canonicalName = canonicalNameForLegacyAction(action)
    names.set(action.name, canonicalName)
    if (action.officialName) names.set(action.officialName, canonicalName)
  }
  return names
}

interface CharacterActionSyncResult {
  character: Character
  actionIdRedirects: Map<string, string>
}

function sameAction(a: CharacterAction, b: CharacterAction): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.kind === b.kind &&
    a.officialName === b.officialName &&
    a.button === b.button
  )
}

function syncCharacterActions(character: Character): CharacterActionSyncResult {
  const template = getCharacterActionTemplate(character.name)
  if (template.length === 0) {
    return { character, actionIdRedirects: new Map() }
  }

  const currentActions = Array.isArray(character.actions) ? character.actions : []
  const legacyActionNames = makeLegacyActionNameMap(character.name)
  const canonicalTemplateNames = new Set(template.map((action) => action.name))
  const consumedActionIds = new Set<string>()
  const actionIdRedirects = new Map<string, string>()
  const actions: CharacterAction[] = []

  // 基本技と、従来の詳細公式名・短縮名のどちらにも一致できるようにする。
  // 同じ基本技へ複数の旧技がまとまる場合は、旧IDをコンボ側で差し替える。
  for (const actionTemplate of template) {
    const candidates = currentActions.filter(
      (action) =>
        !consumedActionIds.has(action.id) &&
        (action.name === actionTemplate.name ||
          (!canonicalTemplateNames.has(action.name) &&
            legacyActionNames.get(action.name) === actionTemplate.name)),
    )
    const preferred =
      candidates.find((action) => action.name === actionTemplate.name) ?? candidates[0]

    if (!preferred) {
      actions.push({ id: newId(), ...actionTemplate })
      continue
    }

    const button = preferred.button ?? candidates.find((action) => action.button)?.button
    const { officialName: _previousOfficialName, ...preferredWithoutOfficialName } = preferred
    const migrated: CharacterAction = {
      ...preferredWithoutOfficialName,
      name: actionTemplate.name,
      kind: actionTemplate.kind,
      ...(actionTemplate.officialName ? { officialName: actionTemplate.officialName } : {}),
      ...(button ? { button } : {}),
    }
    actions.push(sameAction(preferred, migrated) ? preferred : migrated)

    for (const candidate of candidates) {
      consumedActionIds.add(candidate.id)
      if (candidate.id !== preferred.id) {
        actionIdRedirects.set(candidate.id, preferred.id)
      }
    }
  }

  // 旧公式名に一致しない項目は、ユーザーが追加・改名した技としてそのまま残す。
  for (const action of currentActions) {
    if (consumedActionIds.has(action.id)) continue
    actions.push(action)
  }

  // 保存済みの並び順を優先する。移行で複数の旧技が1つにまとまった場合は、
  // 最初に現れた位置へ統合し、新しく追加された基本技だけ末尾へ補完する。
  const actionById = new Map(actions.map((action) => [action.id, action]))
  const orderedActionIds: string[] = []
  const orderedActionIdSet = new Set<string>()
  for (const currentAction of currentActions) {
    const resolvedId = actionIdRedirects.get(currentAction.id) ?? currentAction.id
    if (!actionById.has(resolvedId) || orderedActionIdSet.has(resolvedId)) continue
    orderedActionIds.push(resolvedId)
    orderedActionIdSet.add(resolvedId)
  }
  const orderedActions = [
    ...orderedActionIds.map((id) => actionById.get(id)!),
    ...actions.filter((action) => !orderedActionIdSet.has(action.id)),
  ]

  const changed =
    orderedActions.length !== currentActions.length ||
    orderedActions.some((action, index) => !sameAction(action, currentActions[index]))
  return {
    character: changed ? { ...character, actions: orderedActions } : character,
    actionIdRedirects,
  }
}

/**
 * 保存済みデータに公式キャラ一覧を反映する。
 * - 未登録のキャラを追加
 * - 名前が一致する既存キャラに画像・レア度・属性・武器を補完
 */
export function syncRoster(data: AppData): AppData {
  const characters = [...data.characters]
  const actionIdRedirects = new Map<string, string>()
  let changed = false
  for (const entry of ROSTER) {
    const index = characters.findIndex((c) => c.name === entry.name)
    if (index < 0) {
      characters.push(makeCharacterFromRoster(entry))
      changed = true
    } else {
      const existing = characters[index]
      const withMetadata: Character = {
        ...existing,
        image: existing.image ?? iconFileName(entry.icon),
        rarity: existing.rarity ?? entry.rarity,
        element: existing.element || entry.element,
        weapon: existing.weapon || entry.weapon,
      }
      const synced = syncCharacterActions(withMetadata)
      for (const [from, to] of synced.actionIdRedirects) {
        actionIdRedirects.set(from, to)
      }
      const metadataChanged =
        withMetadata.image !== existing.image ||
        withMetadata.rarity !== existing.rarity ||
        withMetadata.element !== existing.element ||
        withMetadata.weapon !== existing.weapon
      if (synced.character !== withMetadata || metadataChanged) {
        characters[index] = synced.character
        changed = true
      }
    }
  }

  const combos =
    actionIdRedirects.size === 0
      ? data.combos
      : data.combos.map((combo) => ({
          ...combo,
          steps: combo.steps.map((step) => ({
            ...step,
            actions: step.actions.map((action) => {
              const redirectedId = actionIdRedirects.get(action.actionId)
              return redirectedId ? { ...action, actionId: redirectedId } : action
            }),
          })),
        }))
  if (combos !== data.combos) changed = true

  return changed ? { ...data, characters, combos } : data
}

// 全キャラ + 手書きノートのサンプルコンボを初期データとして生成する
export function makeSeedData(): AppData {
  const characters = ROSTER.map(makeCharacterFromRoster)

  const byName = (name: string) => characters.find((c) => c.id && c.name === name)!
  const yangyang = byName('秧秧')
  const phrolova = byName('フローヴァ')
  const chisa = byName('千咲')

  const find = (c: Character, name: string) => c.actions.find((a) => a.name === name)!.id

  const party = {
    id: newId(),
    name: '秧秧・フローヴァ・千咲',
    memberIds: [yangyang.id, phrolova.id, chisa.id],
  }

  const combo = {
    id: newId(),
    partyId: party.id,
    title: 'ノートのローテーション',
    memo: '手書きノートから移植したサンプル',
    updatedAt: new Date().toISOString(),
    steps: [
      {
        id: newId(),
        characterId: yangyang.id,
        actions: [{ id: newId(), actionId: find(yangyang, '共鳴スキル') }],
        note: '敵に当ててゲージを消費する必要あり',
      },
      {
        id: newId(),
        characterId: phrolova.id,
        actions: [
          { id: newId(), actionId: find(phrolova, '通常1'), note: '自然発生' },
          { id: newId(), actionId: find(phrolova, '重撃'), note: '自然発生' },
        ],
        note: '時間に少し余裕あり。ヘカテーを投げて倒れこむモーション',
      },
      {
        id: newId(),
        characterId: chisa.id,
        actions: [
          { id: newId(), actionId: find(chisa, '通常1'), note: '自然発生' },
          { id: newId(), actionId: find(chisa, '共鳴スキル') },
          { id: newId(), actionId: find(chisa, '共鳴解放') },
          { id: newId(), actionId: find(chisa, '重撃'), button: 'R2+△' },
        ],
        note: '共鳴解放と重撃はほぼ同時押し',
      },
      {
        id: newId(),
        characterId: phrolova.id,
        actions: [
          { id: newId(), actionId: find(phrolova, '通常1'), button: '○' },
          { id: newId(), actionId: find(phrolova, '共鳴スキル'), button: 'R2' },
          { id: newId(), actionId: find(phrolova, '音骸'), button: 'L2+□' },
        ],
      },
      {
        id: newId(),
        characterId: chisa.id,
        actions: [
          { id: newId(), actionId: find(chisa, 'ジャンプ') },
          { id: newId(), actionId: find(chisa, '空中攻撃') },
          { id: newId(), actionId: find(chisa, '落下攻撃') },
        ],
      },
      {
        id: newId(),
        characterId: phrolova.id,
        actions: [
          { id: newId(), actionId: find(phrolova, '回避') },
          { id: newId(), actionId: find(phrolova, '共鳴解放') },
        ],
      },
    ],
  }

  return {
    version: 1,
    characters,
    parties: [party],
    combos: [combo],
    buttonMap: { ...DEFAULT_BUTTON_MAP },
  }
}
