# ICE WOLF v1.1.0 — Pro（買い切り課金）の土台

v1.1.0 は **「まず課金の仕組みだけ」** を入れる版です。ゲーム本体（3Dの当たり判定・速度・
マップ・スイッチ・ゲート・階段・AI・サウンド）は **1行も変えていません**。追加したのは、
StoreKit 2 のネイティブプラグイン、その JS 橋渡し、メニュー / SETTINGS から開ける
Pro 画面、そして 12言語の文言です。

> `1.0.0 (Build 12)` は App Store 審査中なので、この作業は `main` から切った
> `feat/ice-wolf-v1.1.0-pro` の上だけで行い、`main` へはマージしていません。

## 1. 売るもの

| 項目 | 値 |
| --- | --- |
| 商品ID | `jp.signlink.IceWolf.pro` |
| 種類 | 非消耗型（買い切り。サブスクリプションではない） |
| 価格 | App Store Connect で決めた価格をそのまま表示（`Product.displayPrice`） |
| 復元 | 必須。Pro 画面に「購入を復元」を常設 |

アプリ内に新しい権利の概念は増やしていません。**Pro かどうかは StoreKit の
`Transaction.currentEntitlements`（ローカルJWS検証つき）だけが決めます。**
端末に保存するのは「起動直後に画面を描くための控え」で、Pro画面を開くたびに
StoreKit へ聞き直し、StoreKit の答えが控えと違えば StoreKit を採用します
（返金されていれば Pro は外れます）。

## 2. 仕組み

```
ゲーム（GDevelop の JS イベント）
  v1.1.0 Pro 購入・復元UI グループ
        │  window.Capacitor.Plugins.IceWolfStoreKit
        ▼
ios/App/App/StoreKitPlugin.swift   （StoreKit 2 / CAPBridgedPlugin）
        │  Product.products / product.purchase() / AppStore.sync()
        ▼
App Store
```

- **ネイティブ側**はメソッド3つだけです。
  - `proStatus()` → `{ supported, productId, priceText, productTitle, productDescription, pro, transactionId }`
  - `purchase()` → `{ result: purchased | cancelled | pending | failed, pro, transactionId, message }`
  - `restore()` → `{ result: restored | none | failed, pro, productIds, message }`
  - `Transaction.updates` も購読し、承認待ち（Ask to Buy）が後から通った分を `finish()` します。
- **登録**は `SceneDelegate` が起動する `IceWolfBridgeViewController`（`CAPBridgeViewController` の
  サブクラス）の `capacitorDidLoad()` で `registerPluginInstance(IceWolfStoreKitPlugin())`。
  Capacitor は登録済みプラグインを `window.Capacitor.Plugins` に自動で生やすので、
  ゲーム側はバンドラも import も要りません。
- **JS 側**（`game.json` の `v1.1.0 Pro 購入・復元UI` グループ）は
  `/* ==== v1.1.0 Pro store ==== */` で囲んだ純粋な部分（状態機械・画面文言・偽StoreKit）と、
  DOM を作る部分に分かれています。純粋な部分は `tests/pro/` が game.json からそのまま取り出して
  Node で走らせます。
- **ネイティブが居ない場所**（ブラウザのプレビュー、GDevelop の実行画面）では、
  落ちずに「購入と復元は App Store 版のアプリでのみ行えます」と出します。
  押しても何も起きず、例外も出ません。

## 3. 画面

- **メニュー**: START / HOW TO PLAY / RECORD / SETTINGS の下に **PRO** ボタン。
- **SETTINGS**: 「PRO / プロ版」の行。右側のボタンは StoreKit の答えに応じて `FREE ›` / `PRO ›`。
- **Pro 画面**（新規オーバーレイ、既存の `.iw-*` の配色に合わせた `.iwp-*`）:
  - タイトルとバッジ（FREE / PRO）
  - 状態の1行（無料版 / Pro有効 / App Store版でのみ購入可）
  - 価格（ストアの表示価格をそのまま）
  - 結果メッセージ（購入しました / キャンセル / 承認待ち / 復元しました / 見つかりません / 失敗）
  - **これから追加する内容の枠**（追加ステージ / キャラクタースキン / 追加モード・ルール）と
    「プロ版の内容は今後のアップデートで追加されます。このバージョンにはまだ含まれていません。」
  - ボタン: プロ版を購入する / 購入を復元 / とじる
- 文言はすべて12言語の表（`pro.*` 28キー × 12言語）。横向き390px高では
  ボタンが2列・行が詰まるメディアクエリを入れ、カードは縦スクロールできます。
- ゲームを開始すると Pro 画面は自動で閉じます。

## 4. 検証（実行済み）

| 検証 | 結果 |
| --- | --- |
| `npm test`（Node / 20テスト） | **20 pass / 0 fail** |
| うち 12言語（表の欠落・日本語混入・Pro画面の全状態×12言語） | **PASS**（138キー / missing 0 / leaks 0） |
| うち StoreKit 橋渡し（購入・キャンセル・承認待ち・失敗・復元・復元なし・ネイティブ無し・タイムアウト・キャッシュ） | **PASS** |
| うち「ゲームを変えていない」ガード（main と比較して Pro グループ以外はリリース表記以外バイト一致、`.github/workflows/` 不変更） | **PASS** |
| 新 GDevelop テスト `v1.1.0 Pro purchase test`（モックランタイムで実行） | **HARNESS PASS（177アサーション / 57フレーム）** |
| HUD 多言語の回帰（ja/en/ko/de/hi で役割・カウンタ・スイッチ・ボタン・再使用秒） | **PASS** |
| JS 構文（全28ブロック + 全43テストソース） | **SYNTAX PASS** |
| `python3 scripts/ios/verify-ios-project.py`（`1.1.0` / `13`） | **ALL CHECKS PASSED**（StoreKit の18項目を含む） |
| Swift 構文（`swiftc -parse`） | **PASS**（型チェックは macOS のビルドで） |
| 実機 Sandbox 購入 | **未実施**（App Store Connect に商品を作ってから） |
| 844×390 の実ブラウザ実測 | **未実施**（CSSは高さ430px以下のメディアクエリで確認） |

## 5. 変更ファイル

- `game.json` — 12言語表に `pro.*` 28キー、イベントグループ `v1.1.0 Pro 購入・復元UI`
  （末尾）、メニューの PRO ボタン、SETTINGS の PRO 行、シーン変数28個、
  新テスト `v1.1.0 Pro purchase test`、リリース表記 `ICE WOLF v1.1.0`
- `ios/App/App/StoreKitPlugin.swift` — 新規（StoreKit 2 プラグイン + ブリッジVC）
- `ios/App/App/SceneDelegate.swift` — `IceWolfBridgeViewController` で起動
- `ios/App/App.xcodeproj/project.pbxproj` — 新ファイルを App ターゲットに追加、`1.1.0 (13)`
- `scripts/ios/verify-ios-project.py` — StoreKit の検証18項目、既定値 `1.1.0` / `13`
- `package.json` — `1.1.0`、`npm test`（`node --test "tests/pro/*.test.mjs"`）、`npm run test:ios`
- `tests/pro/helpers.mjs` / `pro-strings.test.mjs` / `pro-store.test.mjs` / `scope-guard.test.mjs`
- `docs/v110-pro-iap.md`（この資料）、`README.md`

## 6. 追加したシーン変数（読み取り専用＋テスト用）

| 変数 | 意味 |
| --- | --- |
| `ProProductId` | 商品ID（`jp.signlink.IceWolf.pro`） |
| `ProUnlocked` | Pro が有効か |
| `ProAvailable` / `ProSupported` | StoreKit に届くか / 商品が読めたか |
| `ProPriceText` / `ProStatus` / `ProMessage` / `ProLastError` | ストアの表示価格 / 状態 / 画面のメッセージキー / 失敗理由 |
| `ProTransactionId` / `ProSource` / `ProPurchaseCount` / `ProRestoreCount` | 取引ID / 権利の出どころ / 購入回数 / 復元回数 |
| `ProBusy` / `ProReady` / `ProOpen` / `ProUiReady` | 通信中 / 一度でもストアに聞いた / 画面が開いている / 画面ができた |
| `ProViewTitle` … `ProViewClose` | いま画面に出ている12言語の文字（テストと診断用） |
| `ProCommand` | テスト用コマンド（`refresh` / `purchase` / `restore` / `open` / `close`。読むと空） |
| `ProTestAdapter` / `ProTestPrice` / `ProTestOwned` | テスト用の偽StoreKit（`ok` `cancel` `pending` `fail` `throw` `slow` `restore` `restoreNone`）。空なら本物 |

## 7. App Store Connect で必要なこと（1.0.0 の審査が通ってから）

1. **App Store Connect → マイApp → ICE WOLF → App 内課金** で新規作成。
   - 種類: **非消耗型（Consumable ではない）**
   - 参照名: 任意（例 `ICE WOLF Pro`）、**製品ID: `jp.signlink.IceWolf.pro`**（後から変えられません）
   - 価格: 日本を基準に決めて全世界へ（表示は各ストアの現地通貨）
   - 12言語の表示名・説明（アプリと同じ ja/en/zh-Hans/zh-Hant/ko/es/fr/de/pt/it/hi/id）
   - 審査用スクリーンショット（Pro 画面）
   - ステータスを「提出準備完了」に
2. **バージョン 1.1.0 の「App 内課金」欄**にこの商品を追加して、ビルドと一緒に提出。
   審査メモに「Pro は買い切り。購入の復元ボタンは SETTINGS → PRO 画面にあります」と書く。
3. **Sandbox テスター**（App Store Connect → ユーザーとアクセス）を1人作り、
   実機で「購入 → Pro 表示 → アプリ削除 → 再インストール → 復元」を確認。
   TestFlight ビルドでも Sandbox の購入シートが出ます（表示名に [Environment: Sandbox]）。
4. 商品が「提出準備完了」でないと `Product.products(for:)` は空を返し、購入は
   「失敗」になります（アプリは落ちません）。商品を作るまでは無料版のままです。
5. 価格を変えるときは App Store Connect 側だけ。アプリは表示価格をストアから読むので再ビルド不要。

## 8. まだやっていないこと

- Pro の**中身**（追加ステージ・スキン・モード）。今回は「枠」と「買える仕組み」だけです。
- 実機での Sandbox 購入（商品作成後）。
- Android（Google Play）の課金。今回のプラグインは iOS 専用です。
- Pro 特典のゲーム内反映（例: 追加ステージを Pro だけに出す）は、中身を作るときに
  `runtimeScene.__iceWolfV110Pro.snapshot().pro` を見て分岐します。
