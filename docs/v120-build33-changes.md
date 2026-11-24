# ICE WOLF v1.2.0 Build 33 — ステップ②（実機試遊の指摘を全部）

トモアキさんの Build 32 実機画面収録に対する指摘を、そのまま 4 つ + 1 つに分けて直したビルド。
バージョンは `1.2.0` のまま、`CURRENT_PROJECT_VERSION` だけが **33**。

## 1. 試合のあと SETTINGS・PRO が開かない

- **原因**：Build 32 は各ボタンの `pointerdown` を直接聞いていた。シートが少し縦に長く、
  ブラウザがその `pointerdown` を「カードのパンの開始」に使ってしまうと、ボタンは `:hover`
  で赤くなるだけで、タップはスクロールに消費される（＝動画の t32〜t36）。
- **対処**（`v0.6.5 Production Round Start + Main Menu`）：
  - タップは**シートのルートで、キャプチャ段階で 1 回だけ**受ける
    （`pointerdown` / `touchstart` / `click` のどれか最初に届いたもの）。
    指の下の要素から `closest('[data-action]')` で action を読み、メニュー自身の action だけ処理。
  - `fitMenuCard()` でカードを端末に合わせて拡大縮小し、**シートにスクロールを作らない**。
  - 表示中の画面を `sheet.screen` に記録し、**毎フレーム要求された画面に戻す**自己修復。
  - 同じ action の 500ms 以内の再タップは 1 回として扱う（二重発火しない）。

## 2. 走りが「写真が滑っている」ように見える／壁際で消える

（`v0.7.3 ブロックトイ3Dキャラ`）

- 体の高さ 70 → **112**（壁は 160）、4 コマの切替 15 → **9 ステップ/コマ**で足が速く回る。
- 歩幅に合わせた**上下バウンス**、進行方向への**前傾チルト**、足元の**雪煙パーティクル**
  （`PlayerRunSnow` / `PlayerRunSnowTotal`）。
- 体は `depthTest: false` + `renderOrder = 12` で**壁より手前に描く**。壁際でも `YOU` の下に
  ちゃんと体が見える。
- カメラ（`v0.6.4 Normal + Overview camera`）は通常 600 → **500 / 58°**、俯瞰 1050 → **980 / 80°**
  で寄って・見下ろす角度に。

## 3. スティックと右端 UI の見切れ

- ワールドのピル（`1F→2F`、`✓ ON` など）は**キャンバス内にクランプ**（`leftClamped` /
  `topClamped`）。端で半分切れない。
- バーチャルスティックは `env(safe-area-inset-left/bottom) + 8px` の**端末の角**へ。

## 4. ステージ・見た目・ギミック・アクションの底上げ

- **新グループ `v1.3.0 アクション演出`**（シートの最後）：スイッチの光の柱、パッドのリング、
  凍結の氷結晶、救助のリングフラッシュ、ゲートの柱と警報灯、人狼の赤いオーラ。
  状態は `StageFxPillars` / `StageFxRings` / `StageFxShards` / `StageFxFlashes` /
  `StageFxPadRings` / `StageFxLive` / `StageFxFired` に公開。
- **クラシック・アイスアリーナに専用の絵**（Build 33 の新規）：
  `assets/wall_classic.png` / `cap_classic.png` / `floor_classic.png`
  （`python3 tools/make_classic_textures.py` で生成）。明るい氷・スケート跡のリンク・
  雪をかぶったレンガ。1.0.0 の `wall_frostlab` / `floor_frostlab` は**フォールバック**として残す。
- **各ステージの空気と背景**（`tools/b33/stage_extra.js` をステージ芸術ブロックに統合）：
  ステージごとの**ヘミスフィア＋キーライト**、そして境界壁の外側に立つ背景
  （オーロラと氷柱／泡とシマー／フェストゥーンと星／梁と提灯／蛍光灯と時計／配管と星野）。
  すべて 2 メッシュ（lit / glow）＋2 ライトにマージされ、**当たり判定には一切触れない**。
- クラシックには専用キット（`pylon` / `rink` / `drift`）、各ステージにも 1 キットずつ追加
  （`urchin` / `flag` / `sled` / `clock` / `satellite`）し、これまで素だった壁サイズにも装飾を置く。

## 検証

- `npm test` — **293 tests / 293 pass**（Build 32 の 285 に Build 33 の 8 を追加）。
  新ファイル `tests/pro/v120-build33.test.mjs`。動いたのは「変更が意図したもの」だけ：
  クラシックが自前の絵になったこと、シート末尾のブロック並び、タップの受け方、ビルド番号。
- `python3 scripts/ios/verify-ios-project.py` — **ALL CHECKS PASSED**
  （`MARKETING_VERSION = 1.2.0`、`CURRENT_PROJECT_VERSION = 33`）。
- 全 42 の JS ブロックを `new Function('runtimeScene','gdjs','THREE', code)` で構文チェック → **0 エラー**。
- 今回はクレジット節約のため **GDevelop のフル再エクスポートと Playwright の長時間撮影は実施していない**
  （次のビルドで実機/ブラウザ確認を行う）。
