# ICE WOLF v1.1.0 Phase 2 — オンライン対戦のつなぎ方（Supabase Realtime）

Phase 2 は **部屋（ルーム）・ホスト権威の同期・8種のクイックスタンプ** を入れました。
この資料は「サーバーにつなぐ」ためだけの手順書です。ゲームと12言語はもう入っているので、
Supabase のプロジェクトを1つ作り、URL と anon key をアプリに渡せば動きます。

> **テーブルも RLS も要りません。** Phase 2 は Supabase Realtime の
> **Broadcast（チャンネルへのメッセージ）と Presence（誰が居るか）だけ**を使います。
> SQL を1行も書かず、`rooms` / `room_players` のようなテーブルも作りません
> （`docs/v110-online-multiplayer-plan.md` の §3 にあったテーブル案は Phase 3 の
> ランキング・履歴用に保留です）。合言葉を知っている人だけが同じチャンネルに
> 入れる、というシンプルな形です。

---

## 0. いまの状態（2026-11-18）

| 項目 | 状態 |
| --- | --- |
| 部屋を作る・合言葉で入る・席・準備OK・開始 | **実装済み**（`v1.1.0 オンライン中核`） |
| 無料 / Pro の線（下の §2） | **実装済み**（`🔒 PRO` 表示、押すと Pro 画面） |
| ホスト権威の入力 10Hz / スナップショット 5Hz | **実装済み**（受信側で古い・場外・NaN を捨てる） |
| 30秒の猶予・席の Out・ホストの引き継ぎ | **実装済み** |
| 8種のスタンプを相手の言語で表示（12言語） | **実装済み** |
| 試合の中身（ステージ・人数・人狼・スイッチ・時間・役割）を全員に配る | **実装済み** |
| 他のプレイヤーの**位置・向き・役割・状態を3Dに反映**（CPUブロックの差し替え） | **実装済み**（Phase 2b・§7） |
| ゲスト側の CPU AI 停止 / 自分の入力の予測と補正 / 5Hzの補間 | **実装済み**（Phase 2b・§7） |
| スイッチの配置・点灯・ゲート開放・タイマー・生存数・勝敗の同期 | **実装済み**（Phase 2b・§7） |
| 凍結したときの観戦カメラ（オンライン対戦中） | **実装済み**（状態が同期されるので Phase 1 のカメラがそのまま動く） |
| Supabase の URL / anon key | **未設定**（この資料の §3 で入れる。ここだけが残り） |

設定が空のあいだは **練習モード** になります。部屋を作ると「この端末の中だけ」の
部屋ができ、席・ルール・開始・スタンプ・HUD を1台で全部ためせます（画面に
`練習` バッジが出ます）。合言葉で **入る** 方は、設定が入るまで動きません
（入る先のサーバーが無いため）。

---

## 1. Supabase プロジェクトを作る（5分）

1. https://supabase.com/dashboard を開き、signlinkjp のアカウントでログイン
2. **New project**
   - Organization: 既存のもの（無ければ新規）
   - Name: `ice-wolf-online`
   - Database Password: 自動生成のままでOK（ゲームはDBを使いません）
   - Region: **Northeast Asia (Tokyo)**（日本のプレイヤーが近い）
   - Plan: **Free**
3. 作成が終わるまで1〜2分待つ

## 2. Realtime を有効にする（30秒）

1. 左メニュー **Project Settings → API**
   - **Project URL** をコピー（例 `https://abcdefghijklmnop.supabase.co`）
   - **Project API keys** の **anon public** をコピー
     （`service_role` は**絶対に使いません**。ゲームに入れるのは anon だけです）
2. 左メニュー **Database → Replication**（または **Realtime**）
   - Realtime が **ON** であることを確認（新規プロジェクトは既定で ON）
   - **Broadcast / Presence は追加設定なしで使えます**。テーブルを選ぶ必要はありません
     （`postgres_changes` を使うときだけ、テーブルごとに有効化が要ります。Phase 2 は使いません）
3. 料金・上限（Free プラン）
   - 同時接続 200、月 200万メッセージ、帯域 2GB
   - Phase 2 の見積り: 10人 × スナップショット5Hz × 5分 ≒ **1.5MB/試合**。
     1試合あたり入力が約0.3MB、スタンプは無視できる量。月200試合でも余裕です

## 3. アプリに URL と anon key を渡す（3通り・好きなもの）

**このリポジトリに key を書かないでください。** コード側は3か所から読むだけで、
どれも既定は空です（`tests/pro/v110-online.test.mjs` が「ファイルに秘密が無いこと」を
毎回確認します）。

読み込みの優先順位（`readConfig()`）:

1. `window.ICE_WOLF_ONLINE_CONFIG = { url, key }`
2. `localStorage['iceWolfOnlineConfigV1'] = '{"url":"…","key":"…"}'`
3. GDevelop のシーン変数 `OnlineConfigUrl` / `OnlineConfigKey`

（1と2は Supabase のダッシュボードと同じ名前 `SUPABASE_URL` / `SUPABASE_ANON_KEY` でも
読めます。`{ SUPABASE_URL: '…', SUPABASE_ANON_KEY: '…' }`）

### 3-A. iOS の WebView に1行足す（おすすめ・配布物に含められる）

`ios/App/App/public/index.html` の `<head>`（GDevelop のスクリプトより前）に:

```html
<script>
  window.ICE_WOLF_ONLINE_CONFIG = {
    url: 'https://YOUR-PROJECT.supabase.co',
    key: 'eyJhbGciOi...（anon public）'
  };
</script>
```

`npx cap sync ios` のたびに `public/` は再生成されるので、**この1行は
`ios/App/App/public/index.html` ではなく、ビルド後に差し込むスクリプト**に置くのが安全です。
最小のやり方は、TestFlight 用のワークフローが使う `build/` をコピーした直後に
`scripts/ios/` のビルドスクリプトでこのスニペットを書き足すことです
（`.github/workflows/` は触らない約束なので、必要になったら相方に指示してください）。

### 3-B. 端末の localStorage に入れる（ビルドし直さずに試す）

Safari の Web Inspector（Macが必要）か、アプリ内の JS コンソールから:

```js
localStorage.setItem('iceWolfOnlineConfigV1', JSON.stringify({
  url: 'https://YOUR-PROJECT.supabase.co',
  key: 'eyJhbGciOi...'
}));
location.reload();
```

この方法は**その端末だけ**有効です。2台目にも同じように入れてください。

### 3-C. GDevelop のシーン変数で入れる（エディタから）

1. GDevelop で `game.json` を開く → シーン `FROST LAB` → **シーン変数**
2. `OnlineConfigUrl` に Project URL、`OnlineConfigKey` に anon public を貼る
3. 保存

> これは**プロジェクトファイルに key が入る**という意味です。anon key は公開前提の
> 鍵（RLS が無い Phase 2 では「誰でも同じチャンネルに入れる」鍵）ですが、
> リポジトリを public のままにするなら 3-A / 3-B を選んでください。3-C を使う
> ときは `game.json` を push しない（ローカルでだけ試す）ようにします。

## 4. 2台で確かめる

1. 両方の端末で **ONLINE** → バッジが `練習` ではなく **`PRO`** になっている
   （`練習` のままなら §3 の設定が読まれていません）
2. 1台目（Pro）: **部屋を作る** → 6文字の合言葉が出る
3. 2台目: 合言葉を入れて **入室** → 席が増える
4. 1台目: **試合開始** → 両方で同じステージ・同じ人数・同じ役割・同じ壁で始まる
5. どちらかで 💬 → 8個のスタンプ → 押すと**相手の画面に相手の言語で**出る
   （相手の言語は SETTINGS → 言語 で変えて確かめられます）
6. 1台目を機内モードに → 30秒後に席が `Out`、ホストが次の席へ移る
7. 試合中、**相手のブロックトイが相手の操作どおりに動く**（0.2秒くらい遅れて、
   なめらかに動く）。相手がスイッチを押すと2台とも同じスイッチが光り、
   ゲートが開き、相手が凍ると2台とも同じ場所で氷になる
8. 片方が人狼で相手を凍らせると、凍らされた側の画面でも自分のキャラが氷になり、
   観戦カメラ（‹ ›）が使える

## 5. 無料 / Pro の線（ユーザーさんの指定どおり）

| 操作 | 無料 | PRO |
| --- | --- | --- |
| 部屋を作る | ✗（`🔒 PRO`、押すと Pro 画面） | ✓ |
| 10人戦・2人狼・スイッチ3/4・1分/10分 | ✗（`🔒 PRO`） | ✓ |
| クラシック／深海水族館の部屋に入る | ✓ | ✓ |
| 霧の遊園地／雪山ロッジ／廃校／宇宙船の部屋に入る | ✗（`online.proStage` を表示し Pro 画面） | ✓ |

判定は**入る側の端末**で行います（`iceWolfOnlineJoinAccess`）。だから Pro の主催者が
9人の無料の友達を Pro ステージに招待して無料開放、ということは起きません。逆に
**無料の友達はクラシック／水族館の部屋にはいつでも入れます**。人数・人狼・スイッチ・
時間はホストの開始データが全員に効きます（無料の端末でも 10人戦の部屋は10人で始まる）。

## 6. 通信の中身（壊れたときの手がかり）

- チャンネル名: `realtime:ice-wolf-room-<合言葉>`
- 合言葉: 6文字・英数字、紛らわしい `0 O 1 I` は使いません（入る側は小文字・空白・
  ハイフンを許し、`O→Q` / `I→J` に読み替えます）
- クライアント → ホスト: `input` `{seq, moveX, moveY, action, x, y, yaw}` を 10Hz
  （`action` は `none` / `wolf` / `rescue` / `switch`。`x,y,yaw` は自分の予測位置で、
  ホストは 2,000px を超える飛びを捨てる。1.5秒の沈黙のあとは復帰とみなす）
- ホスト → 全員: `snapshot` `{t, phase, timer, players[10], switches, gates, win, winId}` を 5Hz
  - `players[]` は `{id, x, y, z, yaw, floor, role, state, mode}`。`state` は
    `Active` / `Frozen` / `FrozenWolfCandidate` / `Escaped` / `Out`
  - `switches` は `{active, triggered, enabled, serial, on[], spent[], layout[]}`、
    `gates` は `{openIndex, openFloor, unlocked, serial, layout[]}`。
    配置（`layout`）はホストが引いたもので、変わったときだけ載ります
  - `winId` は `wolf` / `human` の**単語**（画面の文は各端末の言語で書きます）
- 部屋の状態: `room`（席・ルール・ステージ）。変更時と0.5秒ごと
- 開始: `start` `{stageId, playerCount, wolfCount, switchCount, matchSeconds, seed, roster, startAt}`
- スタンプ: `stamp` `{stampId, sender}`（**キーだけ**。文章は送りません）
- 生存確認: 25秒ごとに `phoenix` の `heartbeat`。30秒presenceが途切れると席が `Out`

生のフレームは Phoenix プロトコル（Supabase Realtime の WebSocket）です:

```
→ {"topic":"realtime:ice-wolf-room-ABC234","event":"phx_join","ref":"iw1",
   "payload":{"config":{"broadcast":{"self":true},"presence":{"key":"<clientId>"},"private":false}}}
→ {"topic":"realtime:ice-wolf-room-ABC234","event":"broadcast","ref":"iw2",
   "payload":{"type":"broadcast","event":"stamp","payload":{"stampId":"help","sender":"Hana"}}}
← {"event":"presence_state","payload":{"<clientId>":{"metas":[{...}]}}}
```

**ライブラリは読み込みません**（supabase-js を CDN から取ると審査の 2.5.2 に触れるため）。
`createIceWolfSupabaseTransport()` が WebSocket を直接使います。

## 7. Phase 2b（3D通信同期）で入ったこと

`game.json` の **`v1.1.0 オンライン対戦同期`** が、スナップショットをアリーナに
載せる担当です（`tests/pro/v110-sync.test.mjs` が全部を検証します）。

- **ホストの端末が真実**: 自分の席（`YOU`）は自分の指で動かし、ほかの人間の席は
  その端末の 10Hz 入力で動かします。CPU の席は v0.6.1 の AI のまま。
  ゲストが押したスイッチ（1.6秒ホールド）・救助（1.2秒ホールド）・人狼ボタンは
  **ホストが代わりに実行**するので、2台で同じスイッチを2回押しても1回しか点きません。
- **ゲストの端末**: 9つの CPU ブロックは動きません（`OnlineGuestMode`）。
  他の9席は5Hzのスナップショットを約110msかけて補間して動くので、カクつかずに
  歩いて見えます。階段・ワープ・復帰のような大きな飛びは補間せず、その位置に置きます。
- **自分の席**: 予測で動かしつつ、スナップショットが来るたびに32%だけホストの
  位置へ寄せます（260px以上ズレたらホストを正とします）。だから指の反応は落ちず、
  相手の画面ともズレ続けません。
- **役割と状態**: 人狼・凍結・罠で生まれた3人目の人狼・`Out`・`Escaped` は
  ホストのスナップショットが正。凍らされた側の端末でも自分のキャラが氷になり、
  観戦カメラが使えます。
- **盤面とHUD**: スイッチの配置（3〜5個・1F/2F）・点灯・ハズレ・ゲート開放・
  残り時間・生存/凍結数・勝敗は、すべてホストの値。ゲストはホストが引いた
  スイッチとゲートの配置をそのまま使います（`Math.random` はホストだけ）。
- **頭のラベル**: オンラインでは文字（A〜I）ではなく、ロビーで入力した名前を
  出します（CPU は文字のまま）。

### まだ残っている作業

- **Supabase の URL と anon key を入れる**（§3）。これだけで2台の実機対戦ができます。
- 試合中の途中観戦（`SpectatorActive` を presence の `spectator` 席に使う）
- 結果を `room_events` テーブルに残す（Phase 3 のランキング。そのときだけ RLS と
  テーブルが必要になります）
- ゲストの人狼の「感染（3人目の人狼）」は、いまはホストだけが決めます
  （ゲストの端末ではボタンを出しません）。Phase 2c で入力の `infect` を足すところです。

## 8. 審査・プライバシーのメモ

- **ガイドライン 1.2（ユーザー生成コンテンツ）**: 自由入力のチャットはありません。
  送れるのは8種の定型スタンプの**IDだけ**で、表示は端末の言語表から引きます。
  表示名は12言語の既定名（`プレイヤー1` など）＋任意のニックネーム（16文字、
  制御文字を除去）。申請メモにこの2点を書きます。
- 集めるのは `client_id`（端末内で生成した UUID・アカウント無し）、表示名、
  対戦イベントのみ。位置情報・連絡先・Apple ID は取りません。
- `docs/PRIVACY.md` の「オンライン対戦時は合言葉と表示名、対戦イベントを
  Supabase に保存する」に一致します（Phase 2 はブロードキャストのみで、
  保存はしません。保存を始める Phase 3 で文言を確定）。
- オフライン（機内モード）でも1.0.0からの6ステージは全部遊べます。通信を使うのは
  部屋に入ったときだけです。

## 9. つながらないときのチェック

| 画面 | 意味 | 直し方 |
| --- | --- | --- |
| `練習` バッジ | URL/key が読めていない | §3。`https://` で始まる Project URL か、anon key が20文字以上か |
| `オンラインの設定がまだです` | 同じく未設定 | §3 |
| `URL は https://（プロジェクト）.supabase.co の形で…` | URL の形が違う | Project Settings → API の URL をそのまま貼る |
| `anon key が短すぎます` | 別の鍵を貼った | **anon public** を貼る（`service_role` は使いません） |
| `サーバーにつながりません` | WebSocket が開けない | 機内モード・Wi-Fi・Realtime が ON か |
| `入室できませんでした` | 合言葉違い／部屋が閉じた | 6文字を確認。ホストが退出すると部屋は閉じます |
| `このステージは PRO 専用です` | 無料で Pro ステージの部屋に入ろうとした | 仕様どおり（§5）。クラシック／水族館の部屋を選ぶ |
| スタンプが `少し待ってから` | 2秒クールダウン | 2秒待つ（1試合30回まで） |
