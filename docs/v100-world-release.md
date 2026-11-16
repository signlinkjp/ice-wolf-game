# ICE WOLF v1.0.0 — 12言語で世界へ出す最初の版

v0.7.4（Build 6）は日本語だけの試作でした。v1.0.0 は**世界向けの初回提出仕様**です。
ゲームの中身（当たり判定・速度・v0.7.2階段・v0.7.3ブロックトイ・v0.7.4壁ナビ・
サウンド）は**1行も変えず**、画面に出る言葉だけを12言語にし、開発中の表記を
`ICE WOLF v1.0.0` に統一しました。

## 1. 12言語

`ja / en / zh-Hans / zh-Hant / ko / es / fr / de / pt / it / hi / id`

- **初回起動**：`localStorage` に保存が無いとき、言語選択モーダルを出します。
  12言語を**その言語の名前**（日本語 / English / 简体中文 / 繁體中文 / 한국어 /
  Español / Français / Deutsch / Português / Italiano / हिन्दी / Bahasa Indonesia）と
  英語名の2段で並べ、いま選ばれている言語を金色で示します。
- **端末言語の自動判別**：保存が無ければ `navigator.languages` を順に見て
  `ja → ja`、`zh-TW/zh-HK/zh-Hant → zh-Hant`、`zh → zh-Hans`、`ko/es/fr/de/pt/it/hi/id`、
  それ以外は **en**。選択は `iceWolfLanguage` に保存され、次回からは保存が優先です。
- **SETTINGS からいつでも切替**：SETTINGS に「言語 / Language」の行を追加し、
  押すと選択モーダルが開きます（一度選んだ後は「とじる」で閉じられます）。

### 横向きスマホ390px高での見え方

選択モーダルは自前の固定レイヤーで、`overflow-y:auto` ＋
`-webkit-overflow-scrolling:touch` を持ちます。`max-height:430px` のときは
**3列・ボタン高44px**に縮むので、844×390（iPhone横向き）では
**12言語＋「とじる」が1画面に収まり、スクロール不要**。高さ320pxの端末では
339px必要になり、**スクロールして最後の1件まで押せます**（実測は§4）。
カード幅は `min(760px,100%)` なので、390px幅の縦画面でも横にはみ出しません。

## 2. 仕組み（イベントシートの変え方）

イベントシートは日本語で文字を書いています。20個のネイティブなテキスト設定を
書き換えるとラウンド進行を壊す危険があるので、**表示の最後に翻訳をかける**形にしました。

1. **新グループ `v1.0.0 12言語 i18n`（先頭）**
   - 12言語の表（110キー）と `{n}` `{m}` `{id}` `{f}` `{p}` の差し込み
   - `runtimeScene.__iceWolfI18n.t(key, params)` … DOM 用
   - `runtimeScene.__iceWolfI18n.hud(jaText)` … テキストオブジェクト用
     （`生存: 5 / 凍結: 1` `スイッチ: 2/3` `人狼モード再使用まで：7` のような
     数字入りの行はパターンで、それ以外は全文辞書で引きます）
   - 言語の決定・保存・`SETTINGS` からの再選択・初回モーダル
   - 読み取り専用のシーン変数（`LanguageCode` `LanguageCount` `LanguageMissing`
     `LanguageLeaks` `LanguageHudTranslated` ほか）
2. **既存の画面（メニュー / HOW TO PLAY / RECORD / SETTINGS / 役割発表 /
   結果 / やり直し確認 / 人狼役えらび / 長押しボタン / 解凍リング / 効果音 /
   ジョイスティック / カメラ）** は `t()` で文言を引くように変更。
   メニューのHTMLは `data-i18n` 属性で埋めるので、言語を変えると
   **その場で全行が差し替わります**（画面の作り直しなし）。
3. **新グループ `v1.0.0 HUD 多言語反映`（最後）**
   16種のテキストオブジェクトを毎フレーム読み、日本語の行を選択言語に置き換えます。
   オブジェクトごとに「最後に見た日本語」を覚えるので、**プレイ中に言語を変えても
   翻訳の翻訳にならず**、日本語に戻せば元の行に戻ります。
4. 勝敗の判定は `人狼` の文字を読んでいたため、翻訳後も正しく数えられるよう
   `__iceWolfHudSource('WinText')`（記憶している日本語）を見るようにしました
   （記録・結果画面・勝敗の効果音の3か所）。

日本語（`ja`）の表は**v0.7.4 と同じ文字列**なので、日本語で遊ぶ人の画面は変わりません。

## 3. 初回提出向けクリーンアップ

- `❄ Prototype v0.7.4` → **`ICE WOLF v1.0.0`**（メニュー）
- `開発版 v0.7.4` → **`ICE WOLF v1.0.0`**（HUDのビルド表記）
- `package.json` **1.0.0** / `MARKETING_VERSION = 1.0.0` /
  `CURRENT_PROJECT_VERSION = 7` / `verify-ios-project.py` の既定値も **1.0.0 / 7**
- 課金・広告・外部リンクは入れていません（無料版 1.0.0 のまま）。

## 4. 検証（すべて実行済み）

| 検証 | 結果 |
| --- | --- |
| JS構文（全**68**ブロック＋全**41**テストソース、quickjs） | **SYNTAX PASS** |
| 新GDevelopテスト `v1.0.0 12 languages test`（12言語ぶんの画面を実コードで確認） | **HARNESS PASS（135アサーション）** |
| 12言語の欠落・空欄・日本語混入（`LanguageMissing` / `LanguageLeaks`） | **0 / 0**（110キー×12言語） |
| 端末言語の判別（ja/en/zh-Hans/zh-Hant/ko/es/fr/de/pt/it/hi/id・保存優先・英語フォールバック） | **22ケース PASS** |
| HUDに出る日本語がすべて英訳されるか（静的走査） | **COVERAGE PASS**（29候補 / 既知110行） |
| 画面のキーと表の一致（未定義キー・未使用キー・HTMLに残った日本語） | **KEYS PASS** |
| 言語選択モーダルの実ブラウザ実測 | 844×390：**スクロール不要で12言語が収まる**、844×320：**スクロールで全件到達**、390×844：**横はみ出し0** |
| v0.7.2 階段（`work/v072/sim_v072.py`） | **SIMULATION PASS** |
| v0.7.3 ブロックトイ（`work/v073/sim_v073.py`） | **ALL MOCK CHECKS PASS** |
| v0.7.4 壁ナビ（`work/v100/harness_v074_v100.py`） | **HARNESS PASS** |
| iOSプロジェクト（`--marketing-version 1.0.0 --build-number 7`） | **ALL CHECKS PASSED** |

## 5. 変更ファイル

- `game.json` — 新グループ2つ、画面系8ブロックの文言を `t()` 化、
  HOW TO PLAY/SETTINGS/RECORD の再構成、シーン変数13個、
  新テスト `v1.0.0 12 languages test`、既存40テストに言語固定の1行とビルド表記の更新
- `package.json` / `ios/App/App.xcodeproj/project.pbxproj` /
  `scripts/ios/verify-ios-project.py` — 1.0.0 / Build 7
- `docs/v100-world-release.md` — この資料
- `README.md` — v1.0.0 の位置づけに更新

## 6. 追加したシーン変数（テスト・診断用の読み取り専用）

| 変数 | 意味 |
| --- | --- |
| `LanguageCode` | いま表示している言語コード |
| `LanguageCount` / `LanguageList` | 12 / `ja,en,zh-Hans,zh-Hant,ko,es,fr,de,pt,it,hi,id` |
| `LanguageSource` | `saved` / `device` / `chosen` |
| `LanguageSaved` | 保存済みの選択があるか |
| `LanguagePickerOpen` | 初回選択モーダルが開いているか |
| `LanguageCommand` | テストとSETTINGSからの切替コマンド（読むと空になります） |
| `LanguageKeys` / `LanguageMissing` / `LanguageLeaks` | キー数 / 欠落 / 日本語混入 |
| `LanguageHudTracked` / `LanguageHudTranslated` | 翻訳対象のテキスト数 / 実際に訳した数 |
| `I18nReady` | 言語レイヤーが動いているか |

> `.github/workflows/` は触っていません。TestFlightの発火は指示があるまで行いません。
