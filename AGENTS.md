# AGENTS.md — 鳴潮コンボノート 開発ガイド

このリポジトリは、鳴潮（Wuthering Waves）のコンボ・ローテーションをスマホで記録する個人用ツール。
改修時は本ファイルのルールに従うこと。設計の経緯は `docs/research.md` を参照。

## プロジェクトの前提

- 利用者はオーナー1人のみ（PS5でプレイしながらスマホで閲覧・入力する）
- **すべて無料で運用する**。サーバー・アカウント・有料サービスは導入しない
- データは端末のブラウザ内（localStorage）にのみ保存。バックアップはJSONエクスポートで行う
- UIは日本語。スマホ縦持ち（幅390px前後）を基準に、タップしやすい大きめのボタンにする
- 最終的にリポジトリをパブリックにして GitHub Pages で公開予定（ツール完成後）。
  `vite.config.ts` の `base: './'` はそのための設定なので変更しない

## 技術構成とコマンド

- Vite + React + TypeScript。UIフレームワークは使わずプレーンCSS（`src/styles.css`、ダークテーマ）
- `npm run dev` / `npm run build`（tsc型チェック込み）/ `npm run preview`
- 変更後は必ず `npm run build` が通ることを確認する

### 動作確認（この開発環境での方法）

- Chromiumは `/opt/pw-browsers/chromium` にプリインストール済み。`playwright-core` を
  `npm install --no-save playwright-core` で入れ、`executablePath` に上記を指定して起動する
- `vite preview` は dist を再ビルドすると404を返すことがある。**ビルド後はpreviewを再起動**する
- スマホ想定なので viewport 390×844 でスクリーンショットを撮って確認する

## データ設計のルール

- 型定義は `src/types.ts` に集約。`AppData`（version付き）が保存単位
- localStorage キーは `ww_combo_data_v1`（`src/storage.ts`）。
  **保存済みデータを壊す変更をしない**こと。スキーマ変更時は読み込み時マイグレーションで対応する
- 実装済みキャラの初期技は `src/characterActions.ts` の共通テンプレートで管理し、
  通常1〜5・共鳴スキル・重撃・空中攻撃・共鳴解放・協和破壊・音骸・変奏・終奏・回避・ジャンプ・落下攻撃の16項目に絞る
- 形態別通常、強化技、複数段階の共鳴解放などは、利用者が必要に応じて自由に追加・改名する。
  旧版のキャラ別詳細テンプレートは保存済みデータの移行判定にだけ使用し、新規キャラの技パレットには表示しない
- `COMMON_ACTION_TEMPLATE` は未収録キャラやユーザー追加キャラ向けのフォールバック。
  公式技の同期後も、技名をユーザーが自分の呼び方（例: ハサミ1、チェンソー）に自由に編集・追加できることが最重要
- コンボは「行（ComboStep＝キャラ＋技列＋注意書き）」の並び。技ごとに
  自然発生 / 直前と同時押し / ボタン表記（R2+△等）/ メモ を持てる。手書きノートの表現力を落とさない
- PS5のキー配置はユーザーがゲーム内で変更している可能性があるため、ボタン表記は自由入力とする（固定の対応表を作らない）

## キャラクターマスタのルール

- 実装済み全キャラは `src/characterData.ts` の `ROSTER` に収録（2026-07-12 / Ver3.5前半時点で55体）
- アイコンは `public/chars/head_<id>.png`。`<id>` はゲーム内リソース `T_IconRoleHead150_<id>[_UI]` の番号
- 新キャラ追加手順: ①`ROSTER` に1行追加 ②対応する `head_<id>.png` を `public/chars/` に配置
  ③`src/characterActions.ts` の対象キャラ一覧へ名前を追加し、共通の基本技12項目が付与されることを確認する
- 保存済みデータへは起動時に `syncRoster()`（`src/seed.ts`）が名前一致でキャラを追加し、技名一致で未登録の公式技を補完する。
  コンボから参照中の旧技やユーザーが追加・改名した技は削除しない
- `syncRoster` はキャラを**名前**で同定する。ROSTER内の改名は既存データに反映されず重複を生むので原則行わない
- 漂泊者は属性別に4エントリ（回折/消滅/気動/電導）、アイコンは共通で `head_5.png`
- 画像は© Kuro Gamesの公式素材（個人利用目的で同梱）。二次配布目的の加工はしない

## ネットワークアクセスの記録（この開発環境）

コンテナからの外部アクセスはプロキシ経由で、多くのドメインが遮断される。実測結果:

### コンテナからのcurl（画像等バイナリのダウンロード）

| サイト | 結果 |
| --- | --- |
| `wuthering.gg` | ✅ 可。アイコン画像は `https://wuthering.gg/images/iconrolehead150/T_IconRoleHead150_<id>[_UI].png`（152×152 PNG）で直接取得できる |
| `api.hakush.in` | ❌ 502（プロキシ遮断） |
| `api.resonance.rest` | ❌ 502（プロキシ遮断） |
| npm / PyPI 等のレジストリ | ✅ 可（noProxy設定済み） |

### WebFetch（テキスト情報の取得）

| サイト | 結果 |
| --- | --- |
| `game8.jp`（記事ページ） | ✅ 可。キャラ一覧は https://game8.jp/meicho/608916 が有用 |
| `wuthering.gg/characters` | ✅ 可。キャラ名とアイコン画像URLの対応が取れる |
| `wikiwiki.jp/w-w`（日本語Wiki） | ❌ 403 |
| `wutheringwaves.fandom.com` | ❌ 402 |
| `prydwen.gg` | ❌ 403 |

- WebSearch は利用可能。ゲーム最新情報（新キャラ・新バージョン）は知識カットオフ後の可能性が高いので、
  **必ずWebSearch/WebFetchで今日時点の情報を確認**してから実装する
- 推奨手順: キャラ情報の一次確認は Game8、アイコンIDとの突き合わせ・画像取得は wuthering.gg

## Gitルール

- 開発ブランチ: `Codex/wuthering-waves-combo-research-ibbdpr`（指定があるまでこのブランチにpush）
- コミットメッセージは日本語で、何を・なぜ変えたかを箇条書きにする

## 今後のロードマップ

1. リポジトリをパブリック化（オーナーが実施）→ GitHub Pages 公開（Actionsワークフロー追加）
2. PWA化（manifest + Service Worker。画像同梱済みなのでオフライン動作可能）
3. 利便性向上: コンボの複製・並べ替え強化、技パレットの並び順カスタマイズ など
