# ICE WOLF v0.7.1 — モーダル見切れとキービジュアル修正

v0.7.1 は遊びの中身を変えず、実機動画で見つかった2つの表示不具合だけを直した回です。
ゲームのルール・当たり判定・マップ・音・設定項目は v0.7.0 と同一です。

## 1. SETTINGS / HOW TO PLAY / RECORD の上下見切れ

### 原因

- パネルを載せているオーバーレイ（`.iw-screen`）が `align-items:center` で中央寄せのまま、
  パネル側に高さの上限がありませんでした。
- 画面より高いパネルを中央寄せすると、はみ出した**上側**はスクロールでも届きません
  （`overflow:auto` は下方向にしか伸びないため）。実機の横向き（画面高 390px 前後）では
  HOW TO PLAY / SETTINGS が約 550〜600px あり、**タイトル・最初の設定行・BACK ボタン**が
  上下に切れていました。

### 修正

オーバーレイを「スクロールする容器」にし、パネルは「画面に収まる高さ＋中でスクロール」にしました。

```css
.iw-screen{align-items:flex-start;                 /* 上端から並べる＝頭が切れない */
  padding:max(16px,env(safe-area-inset-top,0px)) 12px
          max(24px,env(safe-area-inset-bottom,0px));
  overflow-y:auto;overflow-x:hidden;                /* 縦だけ指でスクロール */
  -webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}
.iw-screen>*{margin-block:auto}                     /* 収まるときは今まで通り中央 */
.iw-card,.iw-modal{max-height:calc(100dvh - 40px);  /* 40px = 上下の余白の合計 */
  overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
```

- `margin-block:auto` は「余白があるときだけ中央、無いときは 0」になるので、
  見た目の中央寄せを保ったまま、はみ出す場合だけ上端から並びます。
- `max-height` は `calc(100vh - 40px)` を先に書き、対応端末では `100dvh` が勝ちます
  （iOS 15.4 以降はツールバーを除いた実際の高さで計算されます）。
- パネルを開き直したときは `scrollTop = 0` に戻すので、途中まで送った状態で開きません
  （HOW TO PLAY・SETTINGS・RECORD すべて）。

### 横向きのスタート画面

このアプリは横向き固定なので、横向き（高さ 520px 以下）だけスタート画面を一段小さくしました。
要素は増減しておらず、比率だけの調整です（縦向き・タブレットの見た目は v0.7.0 のまま）。

```css
@media (max-height:520px) and (orientation:landscape){
  .iw-card{min-height:auto;padding:16px 22px;gap:20px}
  .iw-hero{width:min(184px,23vw)} .iw-title{font-size:clamp(38px,6vw,58px)}
  .iw-btn{min-height:46px;font-size:clamp(15px,2.1vw,22px)} …}
```

## 2. キービジュアル `menu_hero.png` が `[?]` になる

### 原因

- GDevelop 5.6.282 の HTML5 書き出しは、プロジェクトに取り込んだ画像を **`build/` 直下**に
  置きます（v0.6.7 の書き出しでも `floor_frostlab.png` / `wall_frostlab.png` / `ice_freeze.png`
  が直下にあり、`assets/` フォルダは作られません）。
- ところが v0.6.10 は `src="assets/menu_hero.png"` 固定だったため 404 となり、
  ブラウザが `[?]`（壊れた画像）と alt 文字を表示していました。

### 修正

書き出し位置の違いを吸収するため、**順番に試す**方式にしました。

1. `${assetBase}menu_hero.png` — 実際の書き出し位置（`build/menu_hero.png`）
2. `${assetBase}assets/menu_hero.png` — `assets/` 配下に置く書き出しの場合
3. `menu_hero.png` / 4. `assets/menu_hero.png` — `getAssetPath()` が空以外を返す環境向けの控え

- `img` の `error` たびに次の候補へ進み、`MenuHeroAttempt` / `MenuHeroFallbacks` に何番目を
  試したかを記録します（`MenuHeroCandidates` に候補一覧そのもの）。
- 4つすべて失敗したときは画像を隠し、`.iw-hero-missing` の CSS（氷のグラデーション＋❄）に
  差し替えます。**壊れた画像アイコンは二度と出ません**。
- 読み込みに成功した時点で `MenuHeroLoaded = true`、`MenuHeroSource` に実際に読めたパスが入ります。

## 3. バージョン

- ゲーム内表記（`❄ Prototype v0.7.1`）・ビルド表記（`開発版 v0.7.1`）・`package.json` を **0.7.1**。
- `ios/App/App.xcodeproj`: `MARKETING_VERSION = 0.7.1` / `CURRENT_PROJECT_VERSION = 3`（TestFlight Build 3）。
- `scripts/ios/verify-ios-project.py` の既定値も 0.7.1 / 3 に追随（引数なしでも現行版で検証できます）。

## 4. 検証

- **JS構文**: 全 83 ブロック（イベント 46＋テスト 37）を quickjs でコンパイル → すべて PASS。
- **UIモック**: 実プロジェクトの CSS・HTML・シーン変数をそのまま読み込み、ミニDOM上で
  本物のブロックを実行して **58項目 PASS**
  （オーバーレイのスクロール化、パネルの高さ上限、開き直しの先頭戻し、
  ヒーローが 1→2→表示なし と段階的に落ちること、`[?]` を出さないこと、v0.7.1 表記）。
- **iOSプロジェクト**: `python3 scripts/ios/verify-ios-project.py --marketing-version 0.7.1 --build-number 3`
  → **ALL CHECKS PASSED**（横向き固定・アイコン・Bundle ID・バージョン）。
- **GDevelopテスト**: `v0.6.10 Menu Hero test` を新しい候補リスト方式に合わせて更新し、
  バージョン表記を見る 6 本のテストを v0.7.1 に更新（合計 37 本）。

> この回はまだ CI（`ios-testflight.yml`）を発火していません。実機確認は
> `marketing_version=0.7.1` / `build_number=3` / `source_ref=main` で発火したときに行えます。
