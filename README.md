# ICE WOLF — Three.js edition (v1.2.0 / Build 37)

氷の上で遊ぶ人狼ゲーム。見た目は全員同じ。
人狼は5秒の「人狼モード」で触れた人間を凍らせ、人間は凍った仲間を救助し、
スイッチでゲートを開けて脱出するか、時間まで生き残れば勝ちです。

このリポジトリは **v1.2.0 (Build 35) で GDevelop から Three.js に作り直し、Build 36 で音声・日本語起動・通知分離とステージの視認性、Build 37 で6ステージの2階形状と凍結カメラ・キャラ造形を直したもの** です。
ゲーム本体は `src/` の素の ES モジュール + `vendor/three.module.js`（r160）。
ビルドはファイルを `www/` に集めるだけで、バンドラも外部 CDN も使いません。
iOS シェル（`ios/`）・Bundle ID `jp.signlink.IceWolf`・課金 `jp.signlink.IceWolf.pro`・
アプリアイコン・Supabase の `games-realtime` は v1.1.0 からそのまま引き継いでいます。

```
src/
  main.js            画面遷移・入力・ゲームループ・通信の接続
  config.js          すべての数値（速度・救助1.2秒・人狼5秒・最大3人狼…）
  i18n.js            12言語の文言（ja/en/zh-Hans/zh-Hant/ko/es/fr/de/pt/it/hi/id）
  ui.js              ポップHUD・設定・遊び方・PRO・オンライン・結果
  audio.js           WebAudio の効果音とBGM（バックグラウンド復帰対応）
  iap.js             StoreKit 2 プラグイン（IceWolfStoreKit）の呼び出し
  online.js          Supabase Realtime（Broadcast/Presence）のルームと同期
  data/stages.js     6ステージの2階矩形・階段・壁・パッド・スイッチ候補・ギミック・配色
  core/rules.js      ルール（役・凍結・救助・スイッチ・ゲート・勝敗・ギミック）
  core/geometry.js   デッキ形状から枠（外周壁・手すり・崖）と2階層ナビを導出
  core/ai.js         CPU（人間は救助とスイッチ、人狼は追跡と変身）
  render/            Three.js（ステージ・キャラ・エフェクト・カメラ）
```

## コマンド

```bash
npm ci
npm run build        # src/ + assets/ + vendor/ + index.html + styles.css -> www/
npm test             # ユニットテスト（ルール・ステージ・12言語・通信・ガード）
npm run verify       # npm test && build && iOSシェル検証
npm run test:e2e     # 実ブラウザ検証（Chromium）＋ downloads/icewolf-threejs-*.png
npm run ios:sync     # build + npx cap sync ios
npm run ios:build    # 署名して IPA（--upload で TestFlight）
```

`npm run test:e2e` は Playwright（`PLAYWRIGHT_DIR` と `PLAYWRIGHT_BROWSERS_PATH`）を使います。
スクリーンショットの保存先は `SHOT_DIR`（既定 `/workspace/downloads`）。

## ゲームの中身

- **6ステージ**：クラシック（無料）／深海水族館（無料）／霧の遊園地・雪山ロッジ・廃校・宇宙船（PRO）。
  2階の形（東半分／中央の島／北バルコニー／L字／上下2分割／リング）、階段の位置、
  ダッシュとワープの位置がステージごとに違う（Build 37）。
- **10人戦・人狼1〜2人・スイッチ3/5/7/10個（正解3/5）・1/2/3/5分**
- **最初の鬼は試合中ずっと鬼**。人狼鬼（2人目）と罠で人狼鬼になった者だけが人間⇔鬼に変身できる。
  人間状態の人狼鬼は救助対象になりません。
- **鬼は最大3人**。2人狼で始まる試合は罠スイッチなし。
- 凍結中は**自分中心の俯瞰カメラ**。スティックでキャラは動かず、カメラの注目点だけが動く（±18m）。
  `CAM` で自分中心に戻り、救助されれば自動で戻る。`‹ ›` は仲間へカメラを飛ばす（Build 37）。
- 人間・人狼鬼・罠鬼は**人間状態なら全員同じ見た目**。役割はHUDの「役割」表示で分かる。
  遊園地ステージだけ落ち影をオフにした。
- **操作**：固定スティック／画面どこでもドラッグ（設定で切替）。
  `[救助]`（スイッチも同じボタン長押し）`[人狼/変身]` `[指名]` `[1F/2F]` `[CAM]` `[設定]` `[EXIT]` `[💬]`。
  HUD は `pointer-events: none`、ボタンだけ `auto`。移動は氷のレイヤー（#touchLayer / #stick）だけで受けるので、
  ボタンのタップが移動に吸われることはありません（Build 33 の不具合の再発防止）。
- **12言語**・文字サイズ標準/大/特大・効果音/BGM/バイブ・プライバシーポリシー・PRO購入と復元。
- **オンライン**：合言葉6文字のルーム、ホスト権威（入力10Hz・スナップショット5Hz）、
  8種のスタンプは相手の言語で表示、ホスト退出時の引き継ぎ。

## 検証（Build 37 で実行済み）

| 検証 | 結果 |
| --- | --- |
| `npm test` | **151 pass / 0 fail** |
| `npm run build` | `www/`（16モジュール・63ファイル・Build 37） |
| `python3 scripts/ios/verify-ios-project.py --build-dir www` | **ALL CHECKS PASSED**（1.2.0 / 37・12言語の CFBundleLocalizations を含む） |
| `npm run test:e2e`（実際の `www/` を Chromium で起動） | **84/84 checks** |
| 6ステージの到達性（ユニット） | 全スイッチ・ゲート・階段・ワープへ歩いて到達可能 |
| 6ステージの2F形状（ユニット） | 6面すべて異なる・デッキ面積・20秒CPU試合で場外なし |
| 階段とCPU（ユニット） | 全階段を歩いて昇れる／廊下を横切っても昇らない／CPUが2階スイッチを起動する |
| `node tools/audit-stages.mjs` | all stages OK（開発用の一括監査） |

実ブラウザ検証のスクリーンショットは `downloads/icewolf-threejs-*.png`
（home / opening / settings / stages / 6ステージ / 救助・スイッチ / 結果 /
英語・ヒンディー語・日本語の特大HUD）。

## iOS ビルド

このリポジトリの `.github/workflows/ios-testflight.yml` は **GDevelop 版のまま**です
（オーナーが Safari で貼り替える権限境界のため、エージェントは触っていません）。
Three.js 版は **`docs/ios-testflight-threejs.yml`** をそのままコピーして
`.github/workflows/ios-testflight.yml` を上書きしてください。

手順の詳細は `docs/v120-build35-threejs.md`、Build 36 の変更点は `docs/v120-build36-changes.md`、
Build 37 の変更点は `docs/v120-build37-changes.md`、オンラインの設定は `docs/v110-online-setup.md`。

## 旧版（GDevelop）

v1.2.0 までの GDevelop プロジェクトとテストは `legacy/gdevelop/` に保存しています
（`game.json` / `tests-pro/` / 生成スクリプト）。ビルドもテストも参照しません。
