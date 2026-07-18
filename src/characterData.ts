// 2026-07-12 時点（Ver3.5 前半）の実装済みプレイアブルキャラクター一覧
// icon はゲーム内リソース T_IconRoleHead150_<id> に対応（public/chars/head_<id>.png）

export interface RosterEntry {
  name: string
  rarity: 4 | 5
  element: string
  weapon: string
  icon: string
}

export const ROSTER: RosterEntry[] = [
  // ★5（新しい順）
  { name: '秧秧・玄翎', rarity: 5, element: '消滅', weapon: '迅刀', icon: '70' },
  { name: 'ルシラー', rarity: 5, element: '凝縮', weapon: '増幅器', icon: '66' },
  { name: 'ルーシー', rarity: 5, element: '回折', weapon: '拳銃', icon: '68' },
  { name: 'レベッカ', rarity: 5, element: '電導', weapon: '拳銃', icon: '69' },
  { name: 'ダーニャ', rarity: 5, element: '焦熱', weapon: '増幅器', icon: '64' },
  { name: '緋雪', rarity: 5, element: '凝縮', weapon: '迅刀', icon: '67' },
  { name: 'シグリカ', rarity: 5, element: '気動', weapon: '手甲', icon: '65' },
  { name: 'リューク・ヘルセン', rarity: 5, element: '回折', weapon: '手甲', icon: '54' },
  { name: 'エイメス', rarity: 5, element: '焦熱', weapon: '迅刀', icon: '53' },
  { name: 'モーニエ', rarity: 5, element: '焦熱', weapon: '長刃', icon: '61' },
  { name: 'リンネー', rarity: 5, element: '回折', weapon: '拳銃', icon: '60' },
  { name: '千咲', rarity: 5, element: '消滅', weapon: '長刃', icon: '57' },
  { name: '仇遠', rarity: 5, element: '気動', weapon: '迅刀', icon: '56' },
  { name: 'ガルブレーナ', rarity: 5, element: '焦熱', weapon: '拳銃', icon: '55' },
  { name: 'ユーノ', rarity: 5, element: '気動', weapon: '手甲', icon: '48' },
  { name: 'オーガスタ', rarity: 5, element: '電導', weapon: '長刃', icon: '51' },
  { name: 'フローヴァ', rarity: 5, element: '消滅', weapon: '増幅器', icon: '41' },
  { name: 'ルパ', rarity: 5, element: '焦熱', weapon: '長刃', icon: '46' },
  { name: 'シャコンヌ', rarity: 5, element: '気動', weapon: '拳銃', icon: '37' },
  { name: 'カルテジア', rarity: 5, element: '気動', weapon: '迅刀', icon: '40' },
  { name: 'カンタレラ', rarity: 5, element: '消滅', weapon: '増幅器', icon: '34' },
  { name: 'カルロッタ', rarity: 5, element: '凝縮', weapon: '拳銃', icon: '32' },
  { name: 'ザンニー', rarity: 5, element: '回折', weapon: '手甲', icon: '38' },
  { name: 'ロココ', rarity: 5, element: '消滅', weapon: '手甲', icon: '33' },
  { name: 'ブラント', rarity: 5, element: '焦熱', weapon: '迅刀', icon: '44' },
  { name: 'フィービー', rarity: 5, element: '回折', weapon: '増幅器', icon: '45' },
  { name: 'ツバキ', rarity: 5, element: '消滅', weapon: '迅刀', icon: '29' },
  { name: 'ショアキーパー', rarity: 5, element: '回折', weapon: '増幅器', icon: '28' },
  { name: '相里要', rarity: 5, element: '電導', weapon: '手甲', icon: '25' },
  { name: '折枝', rarity: 5, element: '凝縮', weapon: '増幅器', icon: '27' },
  { name: '長離', rarity: 5, element: '焦熱', weapon: '迅刀', icon: '26' },
  { name: '今汐', rarity: 5, element: '回折', weapon: '長刃', icon: '24' },
  { name: '吟霖', rarity: 5, element: '電導', weapon: '増幅器', icon: '17' },
  { name: '忌炎', rarity: 5, element: '気動', weapon: '長刃', icon: '11' },
  { name: 'アンコ', rarity: 5, element: '焦熱', weapon: '増幅器', icon: '8' },
  { name: 'ヴェリーナ', rarity: 5, element: '回折', weapon: '増幅器', icon: '3' },
  { name: '凌陽', rarity: 5, element: '凝縮', weapon: '手甲', icon: '14' },
  { name: '鑑心', rarity: 5, element: '気動', weapon: '手甲', icon: '23' },
  { name: 'カカロ', rarity: 5, element: '電導', weapon: '長刃', icon: '18' },
  { name: '漂泊者（回折）', rarity: 5, element: '回折', weapon: '迅刀', icon: '5' },
  { name: '漂泊者（消滅）', rarity: 5, element: '消滅', weapon: '迅刀', icon: '5' },
  { name: '漂泊者（気動）', rarity: 5, element: '気動', weapon: '迅刀', icon: '5' },
  { name: '漂泊者（電導）', rarity: 5, element: '電導', weapon: '迅刀', icon: '5' },
  // ★4
  { name: '卜霊', rarity: 4, element: '電導', weapon: '増幅器', icon: '58' },
  { name: '灯灯', rarity: 4, element: '電導', weapon: '長刃', icon: '30' },
  { name: '釉瑚', rarity: 4, element: '凝縮', weapon: '手甲', icon: '31' },
  { name: '秧秧', rarity: 4, element: '気動', weapon: '迅刀', icon: '1' },
  { name: '熾霞', rarity: 4, element: '焦熱', weapon: '拳銃', icon: '2' },
  { name: '白芷', rarity: 4, element: '凝縮', weapon: '増幅器', icon: '6' },
  { name: '丹瑾', rarity: 4, element: '消滅', weapon: '迅刀', icon: '10' },
  { name: '散華', rarity: 4, element: '凝縮', weapon: '迅刀', icon: '7' },
  { name: 'アールト', rarity: 4, element: '気動', weapon: '拳銃', icon: '12' },
  { name: '桃祈', rarity: 4, element: '消滅', weapon: '長刃', icon: '9' },
  { name: '淵武', rarity: 4, element: '電導', weapon: '手甲', icon: '15' },
  { name: 'モルトフィー', rarity: 4, element: '焦熱', weapon: '拳銃', icon: '13' },
]

export function iconFileName(icon: string): string {
  return `head_${icon}.png`
}
