# ICE WOLF v1.1.0 — リリース準備（価格・What's New・商品説明）

この資料は **App Store Connect に貼るための文面** と、**価格の決めごと** を1か所にまとめたものです。
アプリの作りは `docs/v110-pro-iap.md`、通信は `docs/v110-online-setup.md`、
Phase 1 のステージは `docs/v110-phase1-stages.md` にあります。

- 版: `1.1.0`（Build 16）
- 商品: `jp.signlink.IceWolf.pro`（非消耗型・買い切り）
- 価格: **¥500**（日本）。表示は StoreKit の `displayPrice`（各ストアの現地通貨）

---

## 1. 価格（確定）

| 項目 | 値 | 備考 |
| --- | --- | --- |
| 日本 | **¥500** | ユーザーさんが 2026-11-18 に確定 |
| 米国 | **$2.99**（近い下のティア）または **$3.99**（近い上のティア） | App Store Connect の価格表で選ぶ。¥500 は $2.99 と $3.99 の間 |
| その他の地域 | App Store の自動換算にまかせる | アプリは現地通貨の表示価格をそのまま出します |
| 種類 | 非消耗型（買い切り） | サブスクリプションではありません |

**アプリ側の扱い**

- 画面の価格は、ストアが答えた `Product.displayPrice` を**そのまま**出します（`¥500` 固定ではありません）。
- ストアがまだ答えていないときだけ、日本語では `¥500`、英語では `$2.99` を仮の表示として出します
  （`ICE_WOLF_PRO_FALLBACK_PRICE` / `ICE_WOLF_PRO_FALLBACK_PRICE_US`）。他の10言語は、
  通貨を推測するより何も出さないほうが正しいので、価格の行を出しません。
- 価格を変えるときは App Store Connect 側だけ。アプリの再ビルドは不要です。

---

## 2. What's New（バージョン 1.1.0 の新機能）

### 日本語（そのまま貼れます）

```
■ PRO版（¥500・買い切り）を追加しました
・6ステージ：クラシック／深海水族館は無料。霧の遊園地・雪山ロッジ・廃校・宇宙船はPRO版で解放
・ステージごとの衣装、10人戦、2人狼、カスタムルール（スイッチ3/4個・1分/10分）
・凍結中に仲間を観戦できるカメラ

■ オンライン対戦
・合言葉（6文字）で集まる部屋。最大10台。ホストの端末が試合を進行します
・8種類のワンタップスタンプは、相手の端末の言語で表示されます
・ホストが退出したときは次の席が引き継ぎ、誰も残っていないときは試合を終了して部屋の画面に戻ります

■ そのほか
・5つの新ステージは、壁・床・天端のテクスチャと3Dの飾り（水槽・遊園地・暖炉・教室・宇宙船）まで、ステージごとの専用になりました
・12言語すべての文言を見直しました（勝ち方の説明をそろえ、SETTINGSのカメラ行も日本語にしました）
```

### English

```
- PRO (one-time purchase, $2.99) is here
  - Six stages: Classic and Deep-Sea Aquarium are free; Misty Amusement Park,
    Snowy Mountain Lodge, Abandoned School and Spaceship are PRO
  - Stage outfits, 10-player matches, two wolves, custom rules (3/4 switches,
    1/10 minutes), and a spectator camera while you are frozen
- Online matches
  - A six-character room code for up to 10 phones; the host phone runs the round
  - Eight one-tap stamps, each shown in the receiver's own language
  - If the host leaves, the next seat takes over; if nobody is left, the match
    ends cleanly back on the online screen
- All twelve languages reviewed, with the win conditions worded the same way
  and the SETTINGS camera row no longer left in English
- Every new stage now has its own walls, floor and 3D set dressing: tanks and
  coral, a ferris wheel and tents, a hearth and pines, desks and chalkboards,
  hull panels and a reactor
```

> **オンラインの状態（確定）**: オンライン対戦は Supabase の本番プロジェクト
> **`games-realtime`**（`siivncidktbuyqwsjeqd`）で動きます。URL と publishable key は
> TestFlight ビルドが自動で注入するので（`docs/v110-online-setup.md` §3-A）、配布ビルドは
> 何も設定せずにオンラインで遊べます。未設定の「練習」バッジになるのは GDevelop エディタの
> プレビューだけです。だから What's New の「オンライン対戦」の段落はそのまま出せます。
>
> 疎通は 2026-11-19 に実サーバーで確認済み：join、broadcast（スタンプ・10Hz入力・5Hzスナップショット）、
> presence（2台が互いを見る）、退出の untrack。

---

## 3. App Store の説明文（v1.1.0）

### 日本語

```
ICE WOLF は、氷の上で遊ぶ人狼ゲームです。見た目は全員同じ。
人狼は5秒の「人狼モード」で触れた人間を凍らせ、人間は凍った仲間を救助し、
スイッチでゲートを開けて脱出するか、時間まで生き残れば勝ちです。

■ 6つのステージ
クラシック、深海水族館（無料）、霧の遊園地、雪山ロッジ、廃校、宇宙船（PRO）。
ステージごとに床・壁・雰囲気・衣装が変わります。

■ 7〜10人で遊べる
CPUを混ぜて1人でも、友達と最大10人でも。2人狼のルールもあります。

■ オンライン対戦
合言葉を共有するだけで集まれます。8種類のスタンプは相手の言語で表示されます。

■ 12言語
日本語・英語・簡体字・繁体字・韓国語・スペイン語・フランス語・ドイツ語・
ポルトガル語・イタリア語・ヒンディー語・インドネシア語。

■ 遊びやすさ
コンパクトなバーチャルスティック、通常／俯瞰カメラ、効果音のみのサウンド、
凍結中に仲間を観戦できるカメラ。

■ PRO版（買い切り ¥500）
追加ステージ4つ、衣装、10人戦・2人狼・カスタムルール、観戦カメラが使えます。
購入の復元は SETTINGS → PRO から。
```

### English

```
ICE WOLF is a werewolf game played on ice. Everyone looks the same.
The wolf freezes every human it touches during a 5-second Wolf Mode; the humans
rescue their frozen friends, open a gate with the switches and escape, or survive
until time runs out.

- Six stages: Classic and Deep-Sea Aquarium (free), Misty Amusement Park,
  Snowy Mountain Lodge, Abandoned School and Spaceship (PRO), each with its own
  floors, walls, mood and outfits
- 7 to 10 players: play alone with CPUs or with up to 10 friends; one or two wolves
- Online matches: share a six-character room code; eight one-tap stamps appear in
  the receiver's own language
- Twelve languages: Japanese, English, Simplified and Traditional Chinese, Korean,
  Spanish, French, German, Portuguese, Italian, Hindi, Indonesian
- Comfortable on a phone: compact virtual stick, normal and overhead cameras,
  effects-only sound, and a spectator camera while you are frozen

PRO (one-time purchase) unlocks four more stages, outfits, 10-player matches,
two wolves, custom rules and the spectator camera. Restore purchases from
SETTINGS → PRO.
```

---

## 4. App 内課金の商品情報（App Store Connect）

| 項目 | 値 |
| --- | --- |
| 参照名（内部） | `ICE WOLF Pro` |
| 製品ID | `jp.signlink.IceWolf.pro`（**変更できません**） |
| 種類 | 非消耗型（Consumable ではない） |
| 価格 | 日本 ¥500（§1） |
| 表示名（全12言語） | `ICE WOLF PRO` |
| 審査用スクリーンショット | Pro 画面（メニュー → PRO） |

### 説明文（日本語）

```
ICE WOLF のPRO版です（買い切り）。
・追加ステージ4つ：霧の遊園地、雪山ロッジ、廃校、宇宙船
・ステージごとの衣装
・10人戦、2人狼、カスタムルール（スイッチ3/4個・1分/10分）
・凍結中に仲間を観戦できるカメラ
購入の復元はアプリの SETTINGS → PRO から行えます。
```

### Description (English)

```
The PRO version of ICE WOLF (one-time purchase).
- Four more stages: Misty Amusement Park, Snowy Mountain Lodge, Abandoned School,
  Spaceship
- Stage outfits
- 10-player matches, two wolves, custom rules (3/4 switches, 1/10 minutes)
- A spectator camera while you are frozen
Restore your purchase from SETTINGS → PRO in the app.
```

> App Store Connect の商品ローカライズは、必要な言語だけ埋めれば審査は通ります。
> 12言語ぶん作る場合は、上の日本語・英語を基に、アプリ内の `pro.*` の言い回し
> （`pro.soon1`〜`pro.soon3`、`pro.soonNote`）に合わせてください。

---

## 5. 審査メモ（Review Notes に貼る）

```
- PRO is a one-time (non-consumable) purchase, product id jp.signlink.IceWolf.pro.
  Restore Purchases is always available: menu → PRO, or SETTINGS → PRO.
- No free-text chat. Players can only send eight fixed stamps; only the stamp id
  travels and each phone prints it from its own language table.
- Display names are optional nicknames (max 16 characters, control characters
  removed), default "Player 1" and so on in twelve languages.
- Online rooms use Supabase Realtime (Broadcast + Presence) with the project's
  anon key; no user accounts, no location, no contacts. See docs/PRIVACY.md.
- The app works fully offline: all six stages and the CPU matches need no network.
```

---

## 6. 公開前チェックリスト

- [x] 価格 ¥500（`ICE_WOLF_PRO_FALLBACK_PRICE`）、米国ティアの注記
- [x] What's New（日英）
- [x] App Store 説明文（日英）・IAP 説明（日英）
- [x] 12言語の勝ち方の文言を統一（`menu.tagline` / `hud.gateEscape` / `how.items`）
- [x] `npm test` 109 pass / 0 fail
- [x] `python3 scripts/ios/verify-ios-project.py` ALL CHECKS PASSED
- [ ] App Store Connect に商品を作る（§4）
- [ ] Sandbox で購入 → 復元を実機確認
- [ ] Supabase の URL / anon key を入れる（オンラインを出す場合）
