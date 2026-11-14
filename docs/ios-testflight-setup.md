# ICE WOLF iOS / TestFlight セットアップ手順

ICE WOLF を iPhone のアプリとして配信するための土台です。GDevelop の HTML5 書き出し（`build/`）を Capacitor 8.6.2 の iOS シェルに取り込み、Apple の署名を付けて TestFlight にアップロードするところまでを、GitHub Actions の 1 回の実行で行います。

このドキュメントは「トモアキさんが iPhone の Safari から行う作業」を中心に書いています。コード側はすでにリポジトリに入っているので、必要なのは **App Store Connect のアプリ登録・GitHub Secrets・ワークフローファイルのコミット** の 3 つだけです。

---

## 1. 追加したもの（全体像）

| パス | 役割 |
| --- | --- |
| `package.json` / `package-lock.json` | Capacitor 8.6.2（`@capacitor/core` / `@capacitor/ios` / `@capacitor/cli` / `typescript`）を固定。`npm ci` で誰が実行しても同じ依存になる |
| `capacitor.config.ts` | アプリ名 `ICE WOLF`、Bundle ID `jp.signlink.IceWolf`、`webDir: "build"`（GDevelop の出力先をそのまま取り込む）、背景色 `#0A0F1A`、`contentInset: "never"`（全画面） |
| `ios/` | Capacitor 8.6.2 の SPM テンプレートから生成した Xcode プロジェクト（`App.xcodeproj` + 共有スキーム `App`） |
| `ios/App/App/Info.plist` | 横画面固定・フルスクリーン・ステータスバー非表示などの設定（後述） |
| `ios/App/App/Assets.xcassets/` | アプリアイコン（1024×1024）と起動画面（ダークネイビー＋アイコン） |
| `scripts/ios/build-and-upload-testflight.sh` | 書き出し→同期→アーカイブ→署名→IPA検証→（任意で）TestFlight アップロードを 1 本にしたスクリプト |
| `scripts/ios/verify-ios-project.py` | Xcode 不要の静的チェック（横画面固定・アイコン・バージョン・Bundle ID など）。Mac がなくても実行できる |
| `scripts/ios/asc-readonly-preflight.py` | アップロード前の読み取り専用チェック（アプリ登録の有無、同じビルド番号の重複） |
| `docs/ios-testflight-workflow.yml` | GitHub Actions ワークフロー本体（`.github/workflows/ios-testflight.yml` としてコミットする） |

### バージョン

- Marketing Version（表示バージョン）: **0.6.10**
- Build Number: **1**（`ios/App/App.xcodeproj` の `CURRENT_PROJECT_VERSION`。CI 実行時に上書きできます）
- 表示名: **ICE WOLF** / Bundle ID: **jp.signlink.IceWolf** / Team ID: **TGBNH8WJV6**

---

## 2. 他のアプリと揃えた点（既存シークレットの流儀）

`signlinkjp/bridge-sign-chat`（Sign Link）と `signlinkjp/eleven-game-fresh`（ELEVEN GAME）の TestFlight ワークフローを確認し、**同じ名前・同じ方式**にしました。

| 項目 | 既存 2 アプリ | ICE WOLF |
| --- | --- | --- |
| App Store Connect API キー | `ASC_ADMIN_AB_KEY_ID` / `ASC_ADMIN_AB_ISSUER_ID` / `ASC_ADMIN_AB_KEY_P8_BASE64` | 同じ 3 つ |
| Team ID | `TGBNH8WJV6` | 同じ |
| 署名方式 | `.p12` も `.mobileprovision` も使わず、`xcodebuild -allowProvisioningUpdates` + API キーで Apple に自動発行させる | 同じ |
| アップロード | `xcrun altool --upload-app --apiKey ... --p8-file-path ...` | 同じ |
| ランナー | `macos-26`（Xcode 26.6） | 同じ |
| 配布プロファイル | App Store 配布（`get-task-allow = false`）を IPA から検証 | 同じ検証を入れた |

つまり **新しいシークレットを増やす必要はありません**。ICE WOLF のリポジトリにも同じ 3 つの名前で登録すれば動きます（GitHub の Secrets はリポジトリごとなので、値の再登録は必要です。値は `~/.p8` と同じもの、他のリポジトリの Secrets 画面からは値を表示できません）。

---

## 3. Bundle ID とプロビジョニングの注意点（重要）

Brief のご指摘どおり、ここは踏みやすい罠なので明記します。

1. **既存の .p12 / プロビジョニングプロファイルは使っていません。**
   Sign Link と ELEVEN GAME は、`ASC_ADMIN_AB_*`（Admin 権限の App Store Connect API キー）で「Xcode に証明書とプロファイルを作らせる」方式です。したがって「既存プロファイルが特定の Bundle ID に縛られていて使えない」という問題は起きません。

2. **App ID（`jp.signlink.IceWolf`）は自動で登録されます。**
   Admin 権限の API キーがあれば、`xcodebuild -allowProvisioningUpdates` が Apple Developer 側に App ID と App Store 配布プロファイルを作ります。ワイルドカード（`jp.signlink.*`）のプロファイルが既にあっても、App Store 配布プロファイルは Bundle ID ごとに必要なので、**新しく作られるのが正しい動き**です。

3. **Distribution 証明書はチーム共通なので作り直しになりません。**
   Sign Link / ELEVEN GAME で使っている Apple Distribution 証明書をそのまま再利用します。ただし Distribution 証明書は 1 チーム 3 枚までなので、上限に達していると新規作成に失敗します。その場合は Apple Developer の Certificates 画面で古い証明書を Revoke してから再実行してください（既存アプリの TestFlight 配信は止まりません）。

4. **App Store Connect の「アプリのレコード」は API では作れません。手動作成が必須です。**
   これが無いとアップロードだけが失敗します（ビルドと署名は成功します）。手順は次の章の A です。アップロード前の `asc-readonly-preflight.py` が「アプリレコードが無い」を検出して止めてくれるので、無駄なアップロード失敗は起きません。

5. **Bundle ID は大文字小文字まで一致させてください。**
   `jp.signlink.IceWolf` です。`jp.signlink.icewolf` で登録すると別アプリ扱いになり、IPA と一致せず失敗します。Info.plist 側は `$(PRODUCT_BUNDLE_IDENTIFIER)` を参照しているので、変更するときは Xcode プロジェクトの 1 か所（2 構成）だけ直せば OK です。

6. **iPad も同梱しています。**
   `TARGETED_DEVICE_FAMILY = "1,2"`（iPhone + iPad）、`UIRequiresFullScreen = true`、iPad も横画面のみ。Apple は iPad アプリに 4 方向対応を求めるため、フルスクリーン宣言とセットで横画面固定にしています。iPad を外す場合は `TARGETED_DEVICE_FAMILY = "1"` に変更してください。

---

## 4. トモアキさんがやること（初回だけ・3 ステップ）

### A. App Store Connect にアプリを登録する

1. iPhone の Safari で <https://appstoreconnect.apple.com> を開き、**My Apps** → 左上の **＋** → **New App**。
2. 次のとおり入力します。

| 項目 | 値 |
| --- | --- |
| Platform | iOS |
| Name | `ICE WOLF`（すでに使われていたら `ICE WOLF - Freeze Tag` などに変更可。後で変えられます） |
| Primary Language | Japanese（あとから追加可） |
| Bundle ID | `jp.signlink.IceWolf` ← 一覧に出ない場合は Developer ポータルで先に App ID を登録（後述のメモ） |
| SKU | `icewolf-001`（社内管理用の任意の文字列） |
| User Access | Full Access |

3. 作成後、**TestFlight** タブで「Internal Testing」のグループ（例: `FR` や `IceWolf`）を作り、自分（トモアキさんの Apple ID）を追加しておきます。初回ビルドが処理されると、このグループに配信されます。

> メモ: Bundle ID の一覧に `jp.signlink.IceWolf` が出ない場合は、<https://developer.apple.com/account/resources/identifiers> で **＋ → App IDs → App** から `jp.signlink.IceWolf` を登録してください（Automatic signing でも初回はここが空だと止まることがあります）。ただし通常はワークフロー実行時に自動で登録されます。

### B. GitHub Secrets を 3 つ登録する

<https://github.com/signlinkjp/ice-wolf-game/settings/secrets/actions> を開き、**New repository secret** で次の 3 つを登録します（Sign Link / ELEVEN GAME と同じ名前・同じ値）。

| Name | 値 |
| --- | --- |
| `ASC_ADMIN_AB_KEY_ID` | App Store Connect API キーの Key ID（10 文字） |
| `ASC_ADMIN_AB_ISSUER_ID` | Issuer ID（UUID 形式） |
| `ASC_ADMIN_AB_KEY_P8_BASE64` | `AuthKey_XXXXXXXXXX.p8` を Base64 にした 1 行の文字列 |

`.p8` の Base64 化は、以前 Sign Link のときに使った手順と同じです（改行なしの 1 行を貼り付け）。値は画面に出ないので、私からも読めません。

### C. ワークフローを `main` にコミットする

私の GitHub 連携にはワークフローファイルを書く権限がないため、ここだけ Safari でお願いします（いつもの手順です）。

1. Safari で <https://github.com/signlinkjp/ice-wolf-game> を開く。
2. **Add file** → **Create new file**。
3. ファイル名に `.github/workflows/ios-testflight.yml` と入力。
4. 次の URL を Safari で開くと、コミット済みのワークフローがそのまま表示されます（コピー用）。

   ```
   https://raw.githubusercontent.com/signlinkjp/ice-wolf-game/feature/v065-production-round-start/docs/ios-testflight-workflow.yml
   ```

   全選択（長押し → すべてを選択）→ コピー → GitHub のエディタに貼り付け。
   （迷ったら、リポジトリのブランチを `feature/v065-production-round-start` に切り替えて `docs/ios-testflight-workflow.yml` を開き、**Raw** を表示してコピーでも同じです）
5. **Commit changes** → 「Commit directly to the **main** branch」を選んでコミット。

> `main` に置くのは、GitHub の「Run workflow」ボタンがデフォルトブランチのワークフローにしか出ないためです。ワークフローは入力 `source_ref`（既定 `feature/v065-production-round-start`）のブランチを自分でチェックアウトしてビルドするので、`main` に置いても最新のゲームを焼けます。
> PR #16 を `main` にマージした後は、`source_ref` に `main` を指定すれば OK です（既定値を変える場合はワークフロー内の `default:` を 1 行修正）。

---

## 5. 実行手順（Safari から）

1. <https://github.com/signlinkjp/ice-wolf-game/actions> → 左の **ICE WOLF iOS TestFlight** → **Run workflow**。
2. 入力:

| 入力 | 1 回目（ビルド確認） | 2 回目（TestFlight 配信） |
| --- | --- | --- |
| Use workflow from | `main` | `main` |
| confirmation | ✅ チェック | ✅ チェック |
| upload_to_testflight | ⬜ オフ（ビルドのみ） | ✅ オン |
| build_number | `1` | `1`（同じで OK。まだ Apple に送っていないため） |
| marketing_version | `0.6.10` | `0.6.10` |
| source_ref | `feature/v065-production-round-start` | 同じ |

3. 1 回目が緑になったら、ジョブ `iOS archive, sign and TestFlight` のログ末尾に IPA の SHA-256 と `manifest.json` が出ます。Actions の Artifacts から `icewolf-ios-0.6.10-1` を取得すると、署名済み IPA と `manifest.json`（コミット SHA・game.json の SHA-256・IPA の SHA-256）が残ります。
4. 問題なければ 2 回目を `upload_to_testflight` オンで実行 → 「TESTFLIGHT_UPLOAD=submitted」で完了です。Apple 側の処理に 5〜30 分かかり、その後 TestFlight アプリに ICE WOLF が現れます。

> ビルド番号は **同じ Marketing Version の中で必ず増やしてください**。Apple は同じ番号の再アップロードを拒否します。アップロード前のチェックが `ICEWOLF_BUILD_ALREADY_PRESENT` で止めるので、そのときは `build_number` を 2 に上げて実行します。0.6.11 のようにバージョンを上げたときは 1 に戻して構いません（実際は増やし続けるのが安全です）。

---

## 6. ワークフローの中身

```
html5-export (ubuntu-latest)                     Apple の認証情報は一切使わない
  ├ GDevelop 5.6.282 をダウンロード（sha256 検証）
  ├ game.json を検証（ICE WOLF / FROST LAB が残っているか）
  ├ EXPORT_HTML5_EXTERNAL → build/（index.html, code0.js, libs/, 6 アセット）
  └ build/ を artifact として渡す

ios-testflight (macos-26, Xcode 26.6)            ← needs: html5-export
  ├ 同じコミットか確認 → build/ を受け取る
  ├ Secrets 3 つが揃っているか（無ければ即停止）
  ├ npm ci → npx cap sync ios（build/ → ios/App/App/public）
  ├ scripts/ios/verify-ios-project.py（横画面・アイコン・バージョン）
  ├ xcodebuild archive（自動署名 / API キー）
  ├ xcodebuild -exportArchive（App Store 配布で再署名）
  ├ IPA 検証（Bundle ID・バージョン・codesign・TeamIdentifier・配布プロファイル）
  ├ [オンのとき] App Store Connect 読み取りチェック → xcrun altool でアップロード
  └ 署名済み IPA + manifest.json を artifact で保存
```

書き出しを macOS ではなく Ubuntu で行うのは、このリポジトリで v0.6.5〜v0.6.10 のプレビューを作ってきた **実績のある手順（xvfb + GDevelop 5.6.282 Linux 版）をそのまま使う**ためです。macOS 側で GDevelop を起動する方法は未検証なので、失敗する可能性のある工程を Apple と関係のないジョブに隔離しています。

---

## 7. つまずいたときの見かた

| ログの表示 | 意味と対処 |
| --- | --- |
| `STOP: missing repository secret(s)` | B の Secrets が未登録。名前の綴りを確認 |
| `HOLD: ICEWOLF_ASC_APP_NOT_FOUND` | App Store Connect にアプリのレコードが無い。A を実施（ビルドと署名は成功済み） |
| `HOLD: ICEWOLF_BUILD_ALREADY_PRESENT` | そのビルド番号は使用済み。`build_number` を上げる |
| `exportArchive failed` | 署名・プロファイル作成の失敗。Distribution 証明書の上限（3 枚）や App ID を確認 |
| `MISSING FROM EXPORT` | GDevelop の書き出しにアセットが入っていない。`game.json` か `assets/` の状態を確認 |
| `xcodebuild archive failed` | ビルドエラー。ログに `error:` が出るので、その行を送ってください |
| `STOP: confirmation was not ticked` | 実行時のチェックが入っていない |

---

## 8. 実機で最初に見てほしいこと

TestFlight で入れたら、次を確認してください（次の調整の材料になります）。

- 起動時に **横画面固定**（縦にしても回らない）・**ステータスバーが出ない**
- 起動画面（ダークネイビー＋アイコン）から、白く光らずにゲームへ切り替わる
- ノッチ側・ホームインジケータ側に UI（`生存: X / 凍結: Y`、ジョイスティック、`[ 人狼役にする ]`）が隠れていないか
- 初回タップで効果音が鳴る（iOS はユーザー操作まで音が出ない仕様）
- 3D の描画が 60fps 付近で動く、発熱・電池の減り
- 5 分タイマー、全員凍結の即勝利、`[ 人狼役 ]` の複数選択が Web 版と同じ
- アプリを背面に回して戻ったとき、音とタイマーが破綻しないか

---

## 9. ローカル（Mac なし）でできる確認

このリポジトリの iOS 設定は、Mac がなくても静的チェックできます。

```bash
python3 scripts/ios/verify-ios-project.py
```

横画面固定・ステータスバー非表示・Bundle ID・バージョン・アイコンの 1024×1024 RGB（アルファ無し）・起動画面・`webDir` までを一括で検査します。`--build-dir build` を付けると、書き出した HTML5 が GDevelop の完全なバンドルかも確認します。

---

## 10. 触っていないもの

- `game.json`（ゲーム本体）と既存の 24 本のテストには一切手を入れていません。差分は `package*.json`・`capacitor.config.ts`・`ios/`・`scripts/ios/`・`docs/`・`.gitignore` の追加のみです。
- 既存の `materialize-game.yml` もそのままです。

---

## 11. この先の候補

- **iPad を外す / App Store 申請**: 「App Store に提出」まで進む場合は、App Store Connect でスクリーンショット（6.9 インチ等）・説明文・サポート URL・プライバシーポリシー URL が必要です（ELEVEN GAME と同じ準備）。審査提出はワークフローでは行わず、App Store Connect の画面から手動で行います。
- **ビルド番号の自動化**: 現在は入力で指定。`git rev-list --count HEAD` を既定値にする、あるいは直近 TestFlight ビルドを Apple API から読んで +1 する方式に拡張できます。
- **アプリ内のセーフエリア対応**: 実機で UI がノッチに掛かる場合、`index.html` の viewport に `viewport-fit=cover` とセーフエリアの余白を書き出す処理を書き出し後に挟むのが次の一手です。
