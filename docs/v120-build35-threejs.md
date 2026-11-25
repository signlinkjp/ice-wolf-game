# ICE WOLF v1.2.0 Build 35 — Three.js で一から作り直した版

GDevelop（`game.json` + イベントシート）で積み上げてきた ICE WOLF を、
DOROKEI と同じ方式（Three.js + HTML/CSS/JS + Capacitor 8）で**新しく作り直した**ビルドです。
ルール・6ステージ・通信・課金・アイコンは引き継ぎ、描画と操作と画面はすべて新規です。

- 版: `1.2.0` / Build **35**
- Bundle ID: `jp.signlink.IceWolf`（変更なし）
- 課金: `jp.signlink.IceWolf.pro`（ICE WOLF PRO・変更なし）
- 通信: Supabase `games-realtime`（`siivncidktbuyqwsjeqd`・変更なし）

---

## 1. なぜ作り直したか

ルールも設計も固まっているのに、GDevelop 版は `game.json`（2.3MB）と後付け JS の
継ぎ足しで、3D の走りモーション・ステージ装飾・タッチ操作の干渉を1つ直すたびに
別の場所が壊れる状態でした。Three.js なら、キャラの手足・ステージの立体感・
ボタンと移動の完全分離を**最初から**正しく作れます。見た目の目標は
「ドロケー、カチカチキャッチー以上」です。

## 2. 引き継いだもの（壊していないこと）

| 項目 | 状態 |
| --- | --- |
| `ios/` の Xcode プロジェクト・Team `TGBNH8WJV6`・StoreKit 2 プラグイン | そのまま（`MARKETING_VERSION = 1.2.0`、`CURRENT_PROJECT_VERSION = 35`） |
| IAP `jp.signlink.IceWolf.pro` | そのまま（`src/iap.js` が `IceWolfStoreKit` を呼ぶ） |
| アプリアイコン（Build 32 の「全員集合！氷の追いかけっこ」） | そのまま |
| `assets/` の6ステージ衣装・壁・床・天端・凍結・パッドの画像 | すべて使用（壁・床は色を載せた上に模様として重ね、明るい氷の質感に） |
| Supabase の URL / publishable key / ルーム仕様 | そのまま（合言葉6文字・ホスト権威・10Hz入力・5Hzスナップショット・30秒猶予・ホスト引き継ぎ） |
| ルール（救助1.2秒・スイッチ1.6秒・人狼5秒+CD5秒・最大3人狼・罠・ゲート3つ） | `src/config.js` に定数化して維持 |
| 12言語 | `src/i18n.js`（178キー相当＋新HUD/設定/結果の文言を追加） |

## 3. 新しくなったこと

### 3.1 3D（`src/render/`）

- **キャラクター**：ブロックトイのまま、腕と脚がピボットで実際に前後に振れる走り。
  上下バウンス・前傾・着地のスクワッシュ・足元の雪煙・丸い影。頭上の「YOU」/A〜I タグ。
  人狼モード中だけ赤いツノ・耳・**赤いマント**（台形メッシュ）が出ます。
- **6ステージ**：共有フレーム（48×36m・東半分が5.5m の2Fデッキ・階段2か所・外周壁）に、
  ステージごとの内壁・配色・小道具・天気を載せます。壁は低め（1.4m）にして
  キャラクターが常に見えるようにし、雪の天端・柱・アクセントの帯で rhythm を付けています。
- **明るさ**：床・壁は「パレット色を塗ったキャンバスに、既存テクスチャを薄く重ねる」
  方式（`surface()`）。GDevelop 版の暗いテクスチャをそのまま貼らず、
  ドロケーのような明るいポップ調に。ライトは hemisphere + directional（影あり）+ rim。
- **ステージ固有ギミック**：水族館の海流とマンタ、遊園地のパレード加速、
  ロッジの氷床と吹雪、廃校のチャイム→ドア5秒、宇宙船の低重力と高重力マス。
  すべて試合時計（`elapsed`）から決まるので、通信対戦でも全端末で同じ秒に起きます。
- **カメラ**：通常（後方 11m・高さ 10.4m）／俯瞰（19m・21m）。凍結中は自動で俯瞰に引いて
  凍結位置を映し、`‹ ›` で生存CPUを観戦。

### 3.2 画面（`src/ui.js` + `styles.css`）

**明るい氷のテーマ**に統一しました（ユーザー指定）。ホーム・オープニング・
ステージ選択・設定・遊び方・PRO・オンライン・結果まで、白いカード＋濃紺の文字＋
シアンのアクセント。暗い全画面背景は使っていません。

- ホーム：白いフロステッドパネル（左）＋ 3D アリーナのゆっくりした周回カメラ。
- オープニング：3D で人狼が人間を追いかけ、ロゴが叩きつけられる（3.1秒・タップでスキップ）。
- HUD：角丸の白カード（役割・タイマー・生存/凍結・スイッチ・ゲート・階）、
  下部ヒントバー、中央トースト、勝者バナー、救助の円形ゲージ。
- 設定：役割／人数／人狼／スイッチ数／正解数／試合時間／脱出／罠／カメラ／操作／
  文字サイズ／効果音／BGM／バイブ／言語／復元／リセット。PRO の項目は🔒。
- 12言語・標準/大/特大。`--s` で全体を拡大し、はみ出しは検証で0を確認。

### 3.3 操作（Build 33 の不具合の恒久対策）

- 移動は **#touchLayer（画面全体）** と **#stick（固定スティック）** だけで受けます。
- `#hud` は `pointer-events: none`、ボタンとスティックだけ `auto`。
  DOM の重なり順で「ボタンのタップが移動に吸われる」ことが構造的に起きません。
- 検証：スティックのドラッグで移動、`[救助]` のタップでは座標が動かないことを実ブラウザで確認。

## 4. ルール（今朝の合意を反映）

- **最初の鬼は1人で、試合中ずっと鬼**（人間には戻らない）。
- **人狼鬼（2人目）** は人間⇔鬼に変身できる。人間の姿のあいだは誰も凍らせず、救助対象にもならない。
- **罠の氷**を救助すると、助けた人が**人狼鬼**になる（氷は残る）。**罠スイッチ**を押した人も人狼鬼。
- 鬼は**最大3人**。2人狼で始まる試合は罠なし。人間状態の人狼鬼は救助対象外。
- 勝敗：生きている人間が開いたゲートに触れる／時間切れまで生存 → 人間。
  人間が全員凍る（人狼鬼に変わった場合も含む）→ 人狼。

`tests/unit/rules.test.js` が上記を1つずつ検証し、6ステージ×60秒のAI試合で
NaN・場外・終わらない試合がないことを確認します。

## 5. 通信（`src/online.js`）

v1.1.0 と同じ Supabase Realtime の Broadcast + Presence を、WebSocket で直接使います
（CDN の supabase-js は使いません＝審査 2.5.2 対策）。

- チャンネル `realtime:ice-wolf-room-<CODE>`、合言葉は6文字（0/O/1/I を除く）。
- join の `ok` の直後に presence `track`、退出時に `untrack`（2026-11-19 の実測どおり）。
- ホストが試合を持ち、5Hz のスナップショット（位置・役・状態・スイッチ・ゲート・勝敗理由）を配信。
  ゲストは 10Hz で入力を送り、自分の席だけ予測＋32%補正、他の席は補間。
- 設定は `window.ICE_WOLF_ONLINE_CONFIG`（TestFlight ビルドが
  `scripts/ios/inject-online-config.py` で `index.html` に注入）→ localStorage の順。
- スタンプは ID だけを送り、受け取った端末の言語で表示。2秒クールダウン・1試合30回。

## 6. ビルドとワークフロー

`.github/workflows/ios-testflight.yml` は **GDevelop 版のまま**です（権限境界のため未変更）。
Three.js 版は **`docs/ios-testflight-threejs.yml`** をコピーして上書きしてください。

```bash
# ローカル（macOS）
APPLE_KEY_ID=... APPLE_ISSUER_ID=... APPLE_P8_PATH=~/AuthKey_XXX.p8 \
  bash scripts/ios/build-and-upload-testflight.sh --upload
```

スクリプト／ワークフローの流れ（共通）：

1. `npm ci`
2. `npm test`（103件）
3. `npm run build` → `www/`
4. `npx cap sync ios` → `ios/App/App/public/`
5. `python3 scripts/ios/inject-online-config.py`（Supabase の URL と publishable key）
6. `python3 scripts/ios/verify-ios-project.py --build-dir www --require-online-config`
7. `xcodebuild archive` → `-exportArchive` → `altool --validate-app` → `--upload-app`

ビルド番号は `project.pbxproj` の `CURRENT_PROJECT_VERSION`（いま 35）から読みます。
次のビルドはこの数字を上げるだけで、ワークフローは書き換え不要です。

## 7. 検証結果（Build 35）

| 検証 | 結果 |
| --- | --- |
| `npm test` | **103 pass / 0 fail**（stage 54 / rules 24 / i18n 6 / online 8 / app 11） |
| `npm run build` | 16モジュール・63ファイル、`node --check` 全通過 |
| `verify-ios-project.py --build-dir www` | **ALL CHECKS PASSED**（1.2.0 / 35・webDir www・StoreKit・アイコン・秘密鍵なし） |
| `npm run test:e2e` | **72/72**（実 Chromium・SwiftShader WebGL） |
| 6ステージ | 到達性・スイッチ・ゲート・階段・戦闘がすべて動作 |
| 操作 | スティック移動・全面ドラッグ移動・救助1.2秒・スイッチ1.6秒・ボタンが移動を奪わない |
| レイアウト | en/特大・hi/大・ja/特大・iPhone SE 横 で はみ出し0 |
| 実行時エラー | 0 |

スクリーンショット：`downloads/icewolf-threejs-*.png`

## 8. 残っていること（次のビルド候補）

- 実機（iPhone）での明るさ・文字サイズ・10人の重さの最終確認
- 2台での通信対戦の実機確認（ルーム作成→入室→開始→スタンプ→ホスト退出）
- ステージごとの小道具の追加（水槽の魚群・観覧車の回転など、いまは簡易版）
- オンラインの途中観戦と、結果の `room_events` 保存（Phase 3）
