-- たびおん：テーブル・権限（Row Level Security）の定義。REQUIREMENTS.md「データモデル（Supabase）と権限」のとおり。
--
-- Supabase のプロジェクト設定：
--   Enable RLS on new tables automatically  … 有効
--   Grant API access to new tables automatically … 無効
-- 無効なので、テーブルごとの enable row level security と、必要な操作だけの grant を、すべてここに明示的に書く。
-- 書き忘れると「permission denied」になる。
--
-- 匿名ログイン（signInAnonymously）のユーザーも、ロールは authenticated になる。
-- anon（ログイン前）に読ませるのは spots だけ（M4 は、ログインしていなくても開ける）。
--
-- テーブルは、参照される側を先に作る順（spots → profiles → trips → …）。
-- この SQL は何度流しても壊れないようにはしていない（初回だけ流す）。

grant usage on schema public to anon, authenticated, service_role;

-- ------------------------------------------------------------------
-- テーブル
-- ------------------------------------------------------------------

-- 場所・体験のカタログ。trips などから参照されるので最初に作る
create table public.spots (
  id text primary key,                 -- 例：yamagata-ginzan-yukimi-buro
  name text not null,
  area text not null,                  -- 例：銀山温泉
  prefecture text not null,
  region text not null check (region in ('hokkaido', 'tohoku', 'kanto', 'chubu', 'kansai', 'chugoku_shikoku', 'kyushu')),
  lat double precision,
  lng double precision,
  category text not null check (category in ('food', 'nature', 'onsen', 'activity', 'town', 'culture', 'stay')),
  tags text[] not null,
  season_months int[] not null,        -- 楽しめる月
  description text not null,
  address text,
  hours text,
  price_yen int,                       -- ひとりあたりの目安
  duration_min int,
  access text,
  vibe int check (vibe between 1 and 5), -- 1＝定番 〜 5＝穴場
  is_partner boolean default false,
  images jsonb not null,               -- [{url, credit, credit_url}]
  is_fictional boolean default true
);

-- プロフィール
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  origin text,                         -- 最後に使った出発地（次の旅の初期値）
  created_at timestamptz default now()
);

-- 旅
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,           -- TABI-XXXX
  owner_id uuid not null references auth.users on delete cascade,
  companion text not null default 'undecided'
    check (companion in ('solo', 'friends', 'partner', 'family_kids', 'family_adults', 'undecided')),
  months int[] default '{}',           -- 空なら未定
  nights text default 'undecided' check (nights in ('day', '1', '2', '3plus', 'undecided')),
  origin text,                         -- 都道府県名。null なら未定
  regions text[] default '{}',         -- 空なら未定。'anywhere' もあり
  seed_spot_id text references public.spots, -- 「ここへの旅をつくる」で始めたとき
  status text not null default 'collecting' check (status in ('collecting', 'decided', 'done')),
  decided_at timestamptz,
  created_at timestamptz default now()
);

-- メンバー（言い出し役も含む）
-- TODO(spec): trip_id は仕様書では null 可だが、権限の判定に使うため not null にした。
create table public.members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  name text not null check (char_length(name) between 1 and 10),
  user_id uuid references auth.users on delete set null, -- 参加するまで null
  is_owner boolean default false,
  answered_at timestamptz,             -- 質問を終えた時刻
  rated_at timestamptz,                -- 行きたい度合いを終えた時刻（とばした場合も入れる）
  last_seen_plan_version int default 0,
  unique (trip_id, name)
);

-- 質問への回答（1問1行。とばした問いは行を作らない）
create table public.answers (
  member_id uuid references public.members on delete cascade,
  question_id text not null,           -- wants | pace | moments | ...
  value jsonb not null,                -- 複数：["food","onsen"]、5段階：3、places：["spot_id", ...]
  primary key (member_id, question_id)
);

-- おすすめ（旅ごとの候補）
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  title text not null,                 -- 例：雪と温泉と、ごはんの旅
  area_label text not null,            -- 例：山形・銀山温泉
  spot_ids text[] not null,            -- 2〜4件
  tags text[] not null,
  reason text,                         -- なぜこのおすすめか（40字以内）
  source text not null check (source in ('ai', 'rule')),
  for_member_id uuid references public.members on delete set null, -- 誰の回答をきっかけに作ったか
  created_at timestamptz default now()
);

-- 行きたい度合い
create table public.ratings (
  member_id uuid references public.members on delete cascade,
  candidate_id uuid references public.candidates on delete cascade,
  level int not null check (level between 0 and 4),
  created_at timestamptz default now(),
  primary key (member_id, candidate_id)
);

-- 工程案（作り直すたびに version を上げる）
create table public.plans (
  trip_id uuid primary key references public.trips on delete cascade,
  version int not null default 1,
  title text not null,
  source text not null check (source in ('ai', 'rule')),
  updated_reason text,                 -- 例：「3人目の回答で更新しました」
  updated_at timestamptz default now()
);

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  day int not null,                    -- 1始まり
  position int not null,
  spot_id text references public.spots,
  title text not null,                 -- 例：蔵王の樹氷を見に行く
  time_hint text,                      -- 例：11:00
  pinned boolean default false,
  edited_by_user boolean default false, -- 手で並べ替え・移動・入れ替え・追加した
  source text not null check (source in ('ai', 'rule', 'user'))
);

-- 行った記録
create table public.visits (
  user_id uuid references auth.users on delete cascade,
  spot_id text references public.spots,
  again boolean,                       -- また行きたい / 一度でいい / null
  created_at timestamptz default now(),
  primary key (user_id, spot_id)
);

-- AIの結果の保存（マイページのおすすめと傾向）
create table public.ai_cache (
  user_id uuid references auth.users on delete cascade,
  kind text check (kind in ('home', 'tendency')),
  payload jsonb not null,
  input_hash text not null,            -- 入力が変わったら作り直す
  created_at timestamptz default now(),
  primary key (user_id, kind)
);

-- RLS の判定や外部キーで引くための索引
create index members_trip_id_idx on public.members (trip_id);
create index members_user_id_idx on public.members (user_id);
create index trips_owner_id_idx on public.trips (owner_id);
create index candidates_trip_id_idx on public.candidates (trip_id);
create index ratings_candidate_id_idx on public.ratings (candidate_id);
create index plan_items_trip_id_idx on public.plan_items (trip_id, day, position);
create index visits_spot_id_idx on public.visits (spot_id);

-- ------------------------------------------------------------------
-- 判定用の関数
-- RLS のポリシーの中で同じテーブルを引くと無限に呼び合うため、security definer の関数にまとめる。
-- search_path を空にして、テーブルは public. を付けて書く。
-- ------------------------------------------------------------------

-- ログイン中の人が、その旅の言い出し役か、メンバーか
create function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_id = (select auth.uid()))
      or exists (select 1 from public.members m where m.trip_id = p_trip_id and m.user_id = (select auth.uid()));
$$;

-- ログイン中の人が、その旅の言い出し役か
create function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_id = (select auth.uid()));
$$;

-- そのメンバー行が、ログイン中の本人のものか
create function public.is_my_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.members m where m.id = p_member_id and m.user_id = (select auth.uid()));
$$;

-- 行きたい度合いを付けられるか：本人のメンバー行で、同じ旅のおすすめに対してだけ
create function public.can_rate(p_member_id uuid, p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    join public.candidates c on c.trip_id = m.trip_id
    where m.id = p_member_id and c.id = p_candidate_id and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_trip_member(uuid) from public;
revoke all on function public.is_trip_owner(uuid) from public;
revoke all on function public.is_my_member(uuid) from public;
revoke all on function public.can_rate(uuid, uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated, service_role;
grant execute on function public.is_trip_owner(uuid) to authenticated, service_role;
grant execute on function public.is_my_member(uuid) to authenticated, service_role;
grant execute on function public.can_rate(uuid, uuid) to authenticated, service_role;

-- ------------------------------------------------------------------
-- 権限：テーブルごとに enable row level security → grant → policy
-- anon（ログイン前）には spots の select だけ。service_role は全部。
-- ------------------------------------------------------------------

-- spots：誰でも読める。書き込み不可（seed だけ。seed は SQL Editor か service_role で入れる）
alter table public.spots enable row level security;
grant select on public.spots to anon, authenticated;
grant all on public.spots to service_role;
create policy spots_select on public.spots for select to anon, authenticated using (true);

-- profiles：本人だけ
alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using (id = (select auth.uid()));

-- trips：読めるのはその旅のメンバー（参加前にコードで探すのはサーバー経由）。書けるのは owner
alter table public.trips enable row level security;
grant select, insert, update, delete on public.trips to authenticated;
grant all on public.trips to service_role;
-- owner_id の直接比較を先に書く：insert ... returning の直後は、関数の中から新しい行がまだ見えないため。
create policy trips_select on public.trips for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_trip_member(id));
create policy trips_insert on public.trips for insert to authenticated with check (owner_id = (select auth.uid()));
create policy trips_update on public.trips for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy trips_delete on public.trips for delete to authenticated using (owner_id = (select auth.uid()));

-- members：読めるのは同じ旅のメンバー。書けるのは owner。
-- 自分の行の user_id は、参加時にサーバー（service_role）が入れる。
-- TODO(spec): 仕様書の「書ける人」は owner だけだが、本人が自分の answered_at / rated_at / last_seen_plan_version を
-- 更新する必要があるため、本人の行の更新も許可した。更新できる列は column grant で次の4つに絞る
-- （user_id・is_owner・trip_id はブラウザから変えられない）。
alter table public.members enable row level security;
grant select, insert, delete on public.members to authenticated;
grant update (name, answered_at, rated_at, last_seen_plan_version) on public.members to authenticated;
grant all on public.members to service_role;
create policy members_select on public.members for select to authenticated using (public.is_trip_member(trip_id));
create policy members_insert on public.members for insert to authenticated
  with check (
    public.is_trip_owner(trip_id)
    and (user_id is null or user_id = (select auth.uid()))
    and (is_owner is not true or user_id = (select auth.uid()))
  );
create policy members_update on public.members for update to authenticated
  using (public.is_trip_owner(trip_id) or user_id = (select auth.uid()))
  with check (public.is_trip_owner(trip_id) or user_id = (select auth.uid()));
create policy members_delete on public.members for delete to authenticated using (public.is_trip_owner(trip_id));

-- answers：本人だけ（読むのも書くのも）
alter table public.answers enable row level security;
grant select, insert, update, delete on public.answers to authenticated;
grant all on public.answers to service_role;
create policy answers_select on public.answers for select to authenticated using (public.is_my_member(member_id));
create policy answers_insert on public.answers for insert to authenticated with check (public.is_my_member(member_id));
create policy answers_update on public.answers for update to authenticated
  using (public.is_my_member(member_id)) with check (public.is_my_member(member_id));
create policy answers_delete on public.answers for delete to authenticated using (public.is_my_member(member_id));

-- ratings：本人の分だけ直接読める。書けるのも本人だけ（同じ旅のおすすめにだけ）。
-- ほかの人の分は、テーブルを直接読ませず、サーバー（service_role）で集計した名前なしの配列だけを返す。
alter table public.ratings enable row level security;
grant select, insert, update, delete on public.ratings to authenticated;
grant all on public.ratings to service_role;
create policy ratings_select on public.ratings for select to authenticated using (public.is_my_member(member_id));
create policy ratings_insert on public.ratings for insert to authenticated with check (public.can_rate(member_id, candidate_id));
create policy ratings_update on public.ratings for update to authenticated
  using (public.is_my_member(member_id)) with check (public.can_rate(member_id, candidate_id));
create policy ratings_delete on public.ratings for delete to authenticated using (public.is_my_member(member_id));

-- candidates：読めるのは同じ旅のメンバー。書けるのはサーバー（service_role）だけ
alter table public.candidates enable row level security;
grant select on public.candidates to authenticated;
grant all on public.candidates to service_role;
create policy candidates_select on public.candidates for select to authenticated using (public.is_trip_member(trip_id));

-- plans：読めるのは同じ旅のメンバー。
-- TODO(spec): 仕様書は plans の書き込み先を決めていない。version を上げるのはサーバーだけにした（段階3で確かめる）。
alter table public.plans enable row level security;
grant select on public.plans to authenticated;
grant all on public.plans to service_role;
create policy plans_select on public.plans for select to authenticated using (public.is_trip_member(trip_id));

-- plan_items：読むのも書くのも、同じ旅のメンバー全員（誰でも、決める前も決めたあとも直せる）
alter table public.plan_items enable row level security;
grant select, insert, update, delete on public.plan_items to authenticated;
grant all on public.plan_items to service_role;
create policy plan_items_select on public.plan_items for select to authenticated using (public.is_trip_member(trip_id));
create policy plan_items_insert on public.plan_items for insert to authenticated with check (public.is_trip_member(trip_id));
create policy plan_items_update on public.plan_items for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy plan_items_delete on public.plan_items for delete to authenticated using (public.is_trip_member(trip_id));

-- visits：本人だけ
alter table public.visits enable row level security;
grant select, insert, update, delete on public.visits to authenticated;
grant all on public.visits to service_role;
create policy visits_select on public.visits for select to authenticated using (user_id = (select auth.uid()));
create policy visits_insert on public.visits for insert to authenticated with check (user_id = (select auth.uid()));
create policy visits_update on public.visits for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy visits_delete on public.visits for delete to authenticated using (user_id = (select auth.uid()));

-- ai_cache：本人だけ
alter table public.ai_cache enable row level security;
grant select, insert, update, delete on public.ai_cache to authenticated;
grant all on public.ai_cache to service_role;
create policy ai_cache_select on public.ai_cache for select to authenticated using (user_id = (select auth.uid()));
create policy ai_cache_insert on public.ai_cache for insert to authenticated with check (user_id = (select auth.uid()));
create policy ai_cache_update on public.ai_cache for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_cache_delete on public.ai_cache for delete to authenticated using (user_id = (select auth.uid()));
