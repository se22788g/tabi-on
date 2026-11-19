# Supabase の準備（段階2・3）

キーは、自分で `.env.local` に入れる。チャットや GitHub には貼らない。

## 1. 匿名ログインをオンにする
Supabase のダッシュボード → **Authentication → Sign In / Providers**（または Settings）→ **Allow anonymous sign-ins** をオンにして保存。
（全員を最初に匿名ログインさせるので、オフだと画面が動きません。）

## 2. テーブルと権限と spots を入れる（SQL を1回だけ貼る）
1. ダッシュボード → **SQL Editor** → **New query**
2. [`supabase/setup.sql`](setup.sql) を **全部コピーして貼り付け**、**Run**
3. 「Success. No rows returned」と出れば完了
   - 中身：テーブル10個、テーブルごとの `enable row level security`、必要な `grant`、ポリシー、spots 56件
   - 失敗して途中まで入ったとき：**Database → Tables** で作られたテーブルを全部消して（または新しいプロジェクトで）、もう一度最初から流す。2回目に「already exists」と出たら、すでに入っている印
   - spots だけ入れ直したいとき：[`supabase/seed/spots.sql`](seed/spots.sql) だけを貼って Run（何度流しても同じ結果）

## 3. 画面で確かめる
- **Table Editor → spots** が56件
- 各テーブルの横に **RLS enabled** の表示がある（10個すべて）

## 4. `.env.local` を作る
```
cp .env.example .env.local
```
`.env.local` に、次の3つを自分で入れる（場所は、ダッシュボードの **Project Settings → API**（または **API Keys**））。

| 名前 | 入れるもの |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL（`https://xxxx.supabase.co`） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon キー（`eyJ…`）または publishable キー（`sb_publishable_…`）。ブラウザに出てよい |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role キー（`eyJ…`）または secret キー（`sb_secret_…`）。**秘密**。段階3から使う |

## 5. 設定を確かめる
```
node --env-file=.env.local scripts/check-db.mjs
```
全部 `OK` なら完了（spots が56件読める／ログイン前は旅が読めない／匿名ログインできる／他人を owner にした旅は作れない）。キーは表示されません。

## 補足
- 元データは `supabase/seed/spots.json`。直したら `pnpm db:sql` で `spots.sql` と `setup.sql` を作り直す。
- 写真：Figma Make の写真が6件に入っている。ほかは、写真がないときの代わりの画像（色の背景にエリア名）になる。`UNSPLASH_ACCESS_KEY` を入れて `node --env-file=.env.local scripts/fetch-images.ts` を流すと、写真が入る。

## 段階3：新しい SQL を足す（段階2の SQL をすでに流している人）
段階3で、旅づくり・参加・工程案のための関数と、外した場所の記録のテーブル（`removed_spots`）を足しました。
1. ダッシュボード → **SQL Editor** → **New query**
2. [`supabase/apply-stage3.sql`](apply-stage3.sql) を **全部コピーして貼り付け**、**Run**（初回だけ。「Success. No rows returned」と出れば完了）
   - 初めて Supabase を使う人は、これではなく `setup.sql`（段階2・3の両方が入っている）を貼る
3. 確かめる：
   ```
   node --env-file=.env.local scripts/check-flow.mjs
   ```
   匿名ログインの2人で、旅づくり→参加→回答→度合い→工程案→並べ替えまでを、実際の Supabase で通します。キーは表示しません。
   テスト用の旅は、最後に消します（匿名ユーザーは残ります）。`SUPABASE_SERVICE_ROLE_KEY` が必要です。
4. アプリを動かす：`pnpm dev`（`.env.local` の3つの値が入っていること。入れ直したら開発サーバーを入れ直す）

## 画面の動作確認（キーなし）
`scripts/fake-supabase.mjs` は、画面の確認用の偽の Supabase です（あなたのプロジェクトには通信しません）。
`scripts/smoke-stage3.mjs` が、偽のデータで F1〜F6・M2・M3 を通しで動かします（`docs/screens/stage3/` の画像はこれで撮ったもの）。

## 段階6：Realtime の SQL を足す（問12の SQL までをすでに流している人）
工程案・参加状況の変更を、開いている画面にすぐ届けるための設定です。
1. ダッシュボード → **SQL Editor** → **New query**
2. [`supabase/apply-realtime.sql`](apply-realtime.sql) を **全部コピーして貼り付け**、**Run**（初回だけ。何度流しても壊れませんが、流し直す必要はありません）
   - 初めて Supabase を使う人は、これではなく `setup.sql`（これまでの全部が入っている）を貼る
3. 確かめる：**Database → Publications** → `supabase_realtime` に、`members`・`plan_items`・`plans` の3つが入っていること（`ratings` などは入れません。ほかの人の度合いを通知で流さないためです）。

## 段階6：アカウント登録（メールのみ）の設定
アカウントは、**メールだけ**です（Google ログインは作りません）。ダッシュボードで、次の順番に設定してください。キーや秘密の値を、チャットに貼る必要はありません。

### 1. メールでのログインをオンにする
**Authentication → Sign In / Providers**
- **Email**：**Enabled**（初めからオンです）。
  - **Confirm email**：**オン**。確認メールのリンクを開くまで、メールがそのアカウントのものにならないようにします。
  - **Secure email change**：初めのまま（オン）で構いません。
- **Anonymous Sign-Ins**：**オン**（段階2でオンにしたもの。そのままです）。
- **Google** など、ほかのログイン方法：**オフのまま**（Google Cloud の設定は要りません）。

### 2. リダイレクトURL（メールのリンクを開いたあとに戻る先）
**Authentication → URL Configuration**
- **Site URL**：いま開発中なら `http://localhost:3000`。公開したら、公開URL（`https://…`）に変える（段階7）。
- **Redirect URLs** に、次を **追加**（ワイルドカード `**` を付ける）：
  - `http://localhost:3000/**`
  - 公開するときに、`https://（公開URL）/**` も追加する
- アプリは、メールのリンクを開いたあと `/auth/callback` に戻り、ログインに交換して `/me`（マイページ）へ移します。このURLが Redirect URLs に入っていないと、リンクを開いても、Site URL に戻されて、アカウントができません。

### 3. 確認メールの文面（日本語にする）
**Authentication → Email Templates**。使うのは次の2つです。件名と本文を日本語にして、`{{ .ConfirmationURL }}`（リンク）は **消さずに** 入れてください。
- **Change Email Address**（アカウントを作るときの確認メール）
  - 件名の例：`たびおん：メールアドレスの確認`
  - 本文の例：
    ```
    <h2>たびおん</h2>
    <p>下のリンクを開くと、アカウントができます。いまの旅と行きたい度合いは、そのまま残ります。</p>
    <p><a href="{{ .ConfirmationURL }}">アカウントを作る</a></p>
    <p>心当たりがないときは、このメールを無視してください。</p>
    ```
- **Magic Link**（別の端末で、同じメールでログインするときのリンク）
  - 件名の例：`たびおん：ログイン用のリンク`
  - 本文の例：
    ```
    <h2>たびおん</h2>
    <p>下のリンクを開くと、あなたの旅と行きたい場所が見られます。</p>
    <p><a href="{{ .ConfirmationURL }}">ログインする</a></p>
    <p>心当たりがないときは、このメールを無視してください。</p>
    ```

### 4. メールの送信（公開の前に）
- 初めの設定（Supabase 標準の送信）は、**送れる数がとても少なく**、送り先も限られます。試すだけなら足りますが、公開するなら、**Authentication → SMTP Settings** で、自分のメール送信サービスの SMTP を設定してください（段階7の前までに）。
- 試していて「メールを送りすぎました」と出たら、時間をおいてください（上限は **Authentication → Rate Limits** で見られます）。

### 5. 動作を確かめる（手元で。実際にメールが届きます）
1. `pnpm dev` で開き、スマホかブラウザAで、マイページ → 「メールで続ける」→ メールアドレスを入れて「送る」。
2. 届いた確認メールのリンクを開く → マイページに戻り、「アカウントができました。…」が出て、メールアドレスと「ログアウト」が見える。
3. 別のブラウザ（または別の端末）Bで、マイページ → 「メールで続ける」→ **同じメールアドレス**を入れて「送る」→ 「ログイン用のリンクを送りました。」
4. 届いたリンクを開く → Bでも、Aと同じ旅と「まだ行けていない場所」が見える。
- **注意**：別の端末Bは、リンクを開く前は「匿名の別の人」で、そこで作った記録は、ログインすると見えなくなります（ログインしたアカウントの記録に切り替わります）。アカウントを作る前の記録を残したいときは、**先にその端末でアカウントを作って**ください。
