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
