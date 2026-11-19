# Supabase の準備（段階2）

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
