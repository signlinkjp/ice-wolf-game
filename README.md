# ICE WOLF — Three.js edition (v1.2.0 / Build 35)

氷の上で遊ぶ人狼ゲーム。見た目は全員同じ。
人狼は5秒の「人狼モード」で触れた人間を凍らせ、人間は凍った仲間を救助し、
スイッチでゲートを開けて脱出するか、時間まで生き残れば勝ちです。

このリポジトリは **v1.2.0 (Build 35) で GDevelop から Three.js に作り直したもの** です。
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
  data/stages.js     6ステージの壁・パッド・スイッチ候補・ギミック・配色
  core/rules.js      ルール（役・凍結・救助・スイッチ・ゲート・勝敗・ギミック）
  core/geometry.js   2階層アリーナの当たり判定・階段・ナビゲーショングリッド
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

- **6ステージ**：クラシック（無料）／深海水族館（無料）／霧の遊園地・雪山ロッジ・廃校・宇宙船（PRO）
- **10人戦・人狼1〜2人・スイッチ3/5/7/10個（正解3/5）・1/2/3/5分**
- **最初の鬼は試合中ずっと鬼**。人狼鬼（2人目）と罠で人狼鬼になった者だけが人間⇔鬼に変身できる。
  人間状態の人狼鬼は救助対象になりません。
- **鬼は最大3人**。2人狼で始まる試合は罠スイッチなし。
- 凍結中はカメラが俯瞰に引き、「YOU」ラベルは凍結位置に固定。CPUの観戦（‹ ›）も可能。
- **操作**：固定スティック／画面どこでもドラッグ（設定で切替）。
  `[救助]`（スイッチも同じボタン長押し）`[人狼/変身]` `[指名]` `[1F/2F]` `[CAM]` `[設定]` `[EXIT]` `[💬]`。
  HUD は `pointer-events: none`、ボタンだけ `auto`。移動は氷のレイヤー（#touchLayer / #stick）だけで受けるので、
  ボタンのタップが移動に吸われることはありません（Build 33 の不具合の再発防止）。
- **12言語**・文字サイズ標準/大/特大・効果音/BGM/バイブ・プライバシーポリシー・PRO購入と復元。
- **オンライン**：合言葉6文字のルーム、ホスト権威（入力10Hz・スナップショット5Hz）、
  8種のスタンプは相手の言語で表示、ホスト退出時の引き継ぎ。

## 検証（Build 35 で実行済み）

| 検証 | 結果 |
| --- | --- |
| `npm test` | **103 pass / 0 fail** |
| `npm run build` | `www/`（16モジュール・63ファイル） |
| `python3 scripts/ios/verify-ios-project.py --build-dir www` | **ALL CHECKS PASSED**（1.2.0 / 35） |
| `npm run test:e2e`（実際の `www/` を Chromium で起動） | **72/72 checks** |
| 6ステージの到達性（ユニット） | 全スイッチ・ゲート・階段・ワープへ歩いて到達可能 |

実ブラウザ検証のスクリーンショットは `downloads/icewolf-threejs-*.png`
（home / opening / settings / stages / 6ステージ / 救助・スイッチ / 結果 /
英語・ヒンディー語・日本語の特大HUD）。

## iOS ビルド

このリポジトリの `.github/workflows/ios-testflight.yml` は **GDevelop 版のまま**です
（オーナーが Safari で貼り替える権限境界のため、エージェントは触っていません）。
Three.js 版は **`docs/ios-testflight-threejs.yml`** をそのままコピーして
`.github/workflows/ios-testflight.yml` を上書きしてください。

手順の詳細は `docs/v120-build35-threejs.md`、オンラインの設定は `docs/v110-online-setup.md`。

## 旧版（GDevelop）

v1.2.0 までの GDevelop プロジェクトとテストは `legacy/gdevelop/` に保存しています
（`game.json` / `tests-pro/` / 生成スクリプト）。ビルドもテストも参照しません。
