-- 自動生成：scripts/build-sql.mjs。Supabase の SQL Editor に、このファイルを1つだけ貼って Run する。
-- 中身：20260101000000_init.sql、20260102000000_stage3.sql ＋ seed/spots.sql（初回だけ流す）

-- ===== migrations/20260101000000_init.sql =====
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

-- ===== migrations/20260102000000_stage3.sql =====
-- たびおん 段階3：旅を進める画面（F1〜F6）と工程案（M3）のための、テーブルの追加と関数。
-- 20260101000000_init.sql のあとに流す。Supabase の設定（RLS 自動有効・API 自動 grant 無効）は init.sql の冒頭と同じ。
--
-- ほかの人の行きたい度合いは、ブラウザに member_id を送らない。名前を外した配列だけを、
-- 「自分が rated_at を持っているとき」に plan_view() が返す。

-- ------------------------------------------------------------------
-- members に作られた順を足す（一覧の並びを毎回同じにするため）
-- ------------------------------------------------------------------
-- seq：同じ命令の中で何人も入れても、入れた順に必ず並べられるようにする（時刻だけだと同じ値になることがある）
alter table public.members add column seq bigint generated always as identity;
alter table public.members add column created_at timestamptz not null default now();

-- ------------------------------------------------------------------
-- 外した場所の記録（M3「この予定を外す」）。作り直しで勝手に戻さないために使う。
-- TODO(spec)の決定：仕様書は「記録先のテーブルは段階3で決める」としていたため、旅ごと・場所ごとに1行の
-- removed_spots にした。外した場所を足し直したときは、この行を消す。
-- ------------------------------------------------------------------
create table public.removed_spots (
  trip_id uuid not null references public.trips on delete cascade,
  spot_id text not null references public.spots,
  removed_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (trip_id, spot_id)
);

alter table public.removed_spots enable row level security;
grant select, insert, delete on public.removed_spots to authenticated;
grant all on public.removed_spots to service_role;
create policy removed_spots_select on public.removed_spots for select to authenticated using (public.is_trip_member(trip_id));
create policy removed_spots_insert on public.removed_spots for insert to authenticated with check (public.is_trip_member(trip_id));
create policy removed_spots_delete on public.removed_spots for delete to authenticated using (public.is_trip_member(trip_id));

-- ------------------------------------------------------------------
-- 旅をつくる（F1）：旅・言い出し役・一緒に行く人を、まとめて1回で作る
-- ------------------------------------------------------------------
create function public.create_trip(
  p_owner_name text,
  p_companion text,
  p_months int[],
  p_nights text,
  p_origin text,
  p_regions text[],
  p_seed_spot_id text,
  p_names text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  -- 読み間違えやすい 0 O 1 I L は使わない
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text;
  v_trip uuid;
  v_member uuid;
  v_owner text;
  v_name text;
  v_final text;
  v_taken text[];
  k int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_owner := coalesce(nullif(btrim(p_owner_name), ''), 'わたし');
  if char_length(v_owner) > 10 then raise exception 'invalid_name'; end if;
  -- 言い出し役を含めて最大12人
  if coalesce(array_length(p_names, 1), 0) + 1 > 12 then raise exception 'too_many_members'; end if;

  loop
    v_code := 'TABI-' || (
      select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      from generate_series(1, 4)
    );
    exit when not exists (select 1 from public.trips where code = v_code);
  end loop;

  insert into public.trips (code, owner_id, companion, months, nights, origin, regions, seed_spot_id)
  values (
    v_code, v_uid, coalesce(p_companion, 'undecided'), coalesce(p_months, '{}'),
    coalesce(p_nights, 'undecided'), p_origin, coalesce(p_regions, '{}'), p_seed_spot_id
  )
  returning id into v_trip;

  insert into public.members (trip_id, name, user_id, is_owner) values (v_trip, v_owner, v_uid, true)
  returning id into v_member;
  v_taken := array[v_owner];

  foreach v_name in array coalesce(p_names, '{}') loop
    v_name := btrim(v_name);
    if char_length(v_name) < 1 or char_length(v_name) > 10 then raise exception 'invalid_name'; end if;
    -- 同じ名前は「あや（2）」のように分ける
    v_final := v_name;
    k := 2;
    while v_final = any (v_taken) loop
      v_final := v_name || '（' || k || '）';
      k := k + 1;
    end loop;
    v_taken := v_taken || v_final;
    insert into public.members (trip_id, name) values (v_trip, v_final);
  end loop;

  -- 最後に使った出発地を、次の旅の初期値として覚える
  insert into public.profiles (id, display_name, origin) values (v_uid, v_owner, p_origin)
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name),
        origin = coalesce(excluded.origin, public.profiles.origin);

  return jsonb_build_object('trip_id', v_trip, 'code', v_code, 'member_id', v_member);
end;
$$;

-- ------------------------------------------------------------------
-- 招待の中身を見る（F3）：コードを知っている人だけが、まだ参加していない名前などを見られる。
-- ログイン前（anon）でも呼べる。すでに参加している端末なら、trip_id と member_id も返す。
-- ------------------------------------------------------------------
create function public.get_invite(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trip public.trips;
  v_me uuid;
begin
  select * into v_trip from public.trips where code = upper(btrim(p_code));
  if not found then return null; end if;
  select m.id into v_me from public.members m where m.trip_id = v_trip.id and m.user_id = v_uid limit 1;
  return jsonb_build_object(
    'owner_name', (select m.name from public.members m where m.trip_id = v_trip.id and m.is_owner limit 1),
    'companion', v_trip.companion,
    'months', to_jsonb(v_trip.months),
    'nights', v_trip.nights,
    'member_count', (select count(*) from public.members m where m.trip_id = v_trip.id),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'joined', m.user_id is not null) order by m.seq)
      from public.members m where m.trip_id = v_trip.id
    ), '[]'::jsonb),
    'trip_id', case when v_me is not null then v_trip.id end,
    'member_id', v_me
  );
end;
$$;

-- ------------------------------------------------------------------
-- 旅に参加する（F3）：名前を選ぶ（その行に自分の user_id を入れる）か、リストにない名前を入れる
-- ------------------------------------------------------------------
create function public.join_trip(p_code text, p_member_id uuid, p_new_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trip uuid;
  v_member uuid;
  v_name text;
  v_final text;
  v_taken text[];
  k int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select t.id into v_trip from public.trips t where t.code = upper(btrim(p_code));
  if v_trip is null then raise exception 'invalid_code'; end if;

  -- すでに参加済みの端末なら、そのまま返す
  select m.id into v_member from public.members m where m.trip_id = v_trip and m.user_id = v_uid limit 1;
  if v_member is not null then
    return jsonb_build_object('trip_id', v_trip, 'member_id', v_member, 'already', true);
  end if;

  -- 同時に参加しても人数や名前が壊れないよう、旅の行をロックする
  perform 1 from public.trips t where t.id = v_trip for update;

  if p_member_id is not null then
    update public.members set user_id = v_uid
    where id = p_member_id and trip_id = v_trip and user_id is null
    returning id into v_member;
    if v_member is null then raise exception 'member_taken'; end if;
  else
    v_name := btrim(coalesce(p_new_name, ''));
    if char_length(v_name) < 1 or char_length(v_name) > 10 then raise exception 'invalid_name'; end if;
    if (select count(*) from public.members m where m.trip_id = v_trip) >= 12 then raise exception 'too_many_members'; end if;
    select coalesce(array_agg(m.name), '{}') into v_taken from public.members m where m.trip_id = v_trip;
    v_final := v_name;
    k := 2;
    while v_final = any (v_taken) loop
      v_final := v_name || '（' || k || '）';
      k := k + 1;
    end loop;
    insert into public.members (trip_id, name, user_id) values (v_trip, v_final, v_uid) returning id into v_member;
  end if;

  return jsonb_build_object('trip_id', v_trip, 'member_id', v_member, 'already', false);
end;
$$;

-- ------------------------------------------------------------------
-- 工程案を見る（M3）：メンバーだけ。
-- ほかの人の行きたい度合い（levels と avg）は、呼んだ人が rated_at を持っているときだけ入れる。
-- levels は、人ごとの平均（四捨五入）を高い順に並べた名前なしの配列。member_id は返さない。
-- ------------------------------------------------------------------
create function public.plan_view(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trip public.trips;
  v_me public.members;
  v_show boolean;
begin
  if not public.is_trip_member(p_trip_id) then raise exception 'forbidden'; end if;
  select * into v_trip from public.trips t where t.id = p_trip_id;
  select * into v_me from public.members m where m.trip_id = p_trip_id and m.user_id = v_uid limit 1;
  v_show := v_me.rated_at is not null;

  return jsonb_build_object(
    'trip', jsonb_build_object(
      'id', v_trip.id, 'code', v_trip.code, 'companion', v_trip.companion, 'status', v_trip.status,
      'months', to_jsonb(v_trip.months), 'nights', v_trip.nights, 'origin', v_trip.origin
    ),
    'plan', (select to_jsonb(p) - 'trip_id' from public.plans p where p.trip_id = p_trip_id),
    'me', case when v_me.id is null then null else jsonb_build_object(
      'member_id', v_me.id, 'answered_at', v_me.answered_at, 'rated_at', v_me.rated_at,
      'last_seen_plan_version', v_me.last_seen_plan_version
    ) end,
    'member_total', (select count(*) from public.members m where m.trip_id = p_trip_id),
    'rated_count', (select count(*) from public.members m where m.trip_id = p_trip_id and m.rated_at is not null),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'day', i.day, 'position', i.position, 'spot_id', i.spot_id, 'title', i.title,
        'time_hint', i.time_hint, 'pinned', coalesce(i.pinned, false),
        'edited_by_user', coalesce(i.edited_by_user, false), 'source', i.source,
        'avg', case when v_show then (
          select avg(r.level)::float8
          from public.ratings r join public.candidates c on c.id = r.candidate_id
          where c.trip_id = p_trip_id and c.spot_ids @> array[i.spot_id]
        ) end,
        'levels', case when v_show then coalesce((
          select jsonb_agg(x.lv order by x.lv desc)
          from (
            select round(avg(r.level))::int as lv
            from public.ratings r join public.candidates c on c.id = r.candidate_id
            where c.trip_id = p_trip_id and c.spot_ids @> array[i.spot_id]
            group by r.member_id
          ) x
        ), '[]'::jsonb) else '[]'::jsonb end
      ) order by i.day, i.position)
      from public.plan_items i where i.trip_id = p_trip_id
    ), '[]'::jsonb),
    -- 「＋ 候補から足す」用：この旅のおすすめの場所と、みんなの平均
    'candidate_spots', coalesce((
      select jsonb_agg(jsonb_build_object('spot_id', s.spot_id, 'avg', s.avg) order by s.avg desc nulls last, s.spot_id)
      from (
        select u.spot_id,
          case when v_show then (
            select avg(r.level)::float8
            from public.ratings r join public.candidates c2 on c2.id = r.candidate_id
            where c2.trip_id = p_trip_id and c2.spot_ids @> array[u.spot_id]
          ) end as avg
        from (select distinct unnest(c.spot_ids) as spot_id from public.candidates c where c.trip_id = p_trip_id) u
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------------
-- 工程案が変わったことを、全員に知らせる（version を上げ、直した本人には「見た」ことにする）
-- ------------------------------------------------------------------
create function public.touch_plan(p_trip_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version int;
begin
  if not public.is_trip_member(p_trip_id) then raise exception 'forbidden'; end if;
  update public.plans
  set version = version + 1, updated_reason = '工程案が変わりました', updated_at = now()
  where trip_id = p_trip_id
  returning version into v_version;
  if v_version is not null then
    update public.members set last_seen_plan_version = v_version
    where trip_id = p_trip_id and user_id = (select auth.uid());
  end if;
  return v_version;
end;
$$;

-- 「この案で決める」：メンバーなら誰でも
-- TODO(spec): 仕様書は決められる人を限っていない。メンバー全員が決められるようにした。
create function public.decide_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_trip_member(p_trip_id) then raise exception 'forbidden'; end if;
  update public.trips set status = 'decided', decided_at = now() where id = p_trip_id and status = 'collecting';
end;
$$;

-- ------------------------------------------------------------------
-- サーバー（service_role）だけが呼ぶ関数
-- ------------------------------------------------------------------

-- おすすめごとの度合いの合計・最小・人数（工程案づくりの入力）。member_id は返さない
create function public.candidate_stats(p_trip_id uuid)
returns table (candidate_id uuid, level_sum int, level_min int, level_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select r.candidate_id, sum(r.level)::int, min(r.level)::int, count(*)::int
  from public.ratings r join public.candidates c on c.id = r.candidate_id
  where c.trip_id = p_trip_id
  group by r.candidate_id;
$$;

-- 工程案を保存する。pinned か edited_by_user の予定は消さずに残し、残りを新しい予定で置き換える。
-- 新しい予定は、その日の最後に足す（すでに工程案にある場所は足さない）。version を 1 上げる。
-- p_items: [{day, spot_id, title, time_hint, source}]
create function public.save_plan(
  p_trip_id uuid,
  p_title text,
  p_source text,
  p_reason text,
  p_items jsonb,
  p_actor_member_id uuid
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version int;
  r jsonb;
  v_day int;
  v_pos int;
begin
  perform 1 from public.trips t where t.id = p_trip_id for update;
  if not found then raise exception 'trip_not_found'; end if;

  delete from public.plan_items
  where trip_id = p_trip_id and coalesce(pinned, false) = false and coalesce(edited_by_user, false) = false;

  for r in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    continue when exists (select 1 from public.plan_items i where i.trip_id = p_trip_id and i.spot_id = r ->> 'spot_id');
    v_day := (r ->> 'day')::int;
    select coalesce(max(i.position), 0) + 1 into v_pos from public.plan_items i where i.trip_id = p_trip_id and i.day = v_day;
    insert into public.plan_items (trip_id, day, position, spot_id, title, time_hint, pinned, edited_by_user, source)
    values (p_trip_id, v_day, v_pos, r ->> 'spot_id', r ->> 'title', r ->> 'time_hint', false, false, coalesce(r ->> 'source', p_source));
  end loop;

  insert into public.plans (trip_id, version, title, source, updated_reason)
  values (p_trip_id, 1, p_title, p_source, p_reason)
  on conflict (trip_id) do update
    set version = public.plans.version + 1,
        title = excluded.title,
        source = excluded.source,
        updated_reason = excluded.updated_reason,
        updated_at = now()
  returning version into v_version;

  -- 作るきっかけになった本人は、このお知らせを見たことにする
  if p_actor_member_id is not null then
    update public.members set last_seen_plan_version = v_version where id = p_actor_member_id and trip_id = p_trip_id;
  end if;
  return v_version;
end;
$$;

-- ------------------------------------------------------------------
-- 関数の実行権限（init.sql と同じく、明示的に書く）
-- ------------------------------------------------------------------
revoke all on function public.create_trip(text, text, int[], text, text, text[], text, text[]) from public;
revoke all on function public.get_invite(text) from public;
revoke all on function public.join_trip(text, uuid, text) from public;
revoke all on function public.plan_view(uuid) from public;
revoke all on function public.touch_plan(uuid) from public;
revoke all on function public.decide_trip(uuid) from public;
revoke all on function public.candidate_stats(uuid) from public;
revoke all on function public.save_plan(uuid, text, text, text, jsonb, uuid) from public;

grant execute on function public.get_invite(text) to anon, authenticated, service_role;
grant execute on function public.create_trip(text, text, int[], text, text, text[], text, text[]) to authenticated, service_role;
grant execute on function public.join_trip(text, uuid, text) to authenticated, service_role;
grant execute on function public.plan_view(uuid) to authenticated, service_role;
grant execute on function public.touch_plan(uuid) to authenticated, service_role;
grant execute on function public.decide_trip(uuid) to authenticated, service_role;
grant execute on function public.candidate_stats(uuid) to service_role;
grant execute on function public.save_plan(uuid, text, text, text, jsonb, uuid) to service_role;

-- ===== seed/spots.sql =====
-- 自動生成：scripts/build-sql.mjs（元データ：supabase/seed/spots.json）。手で直さない。
-- 架空の旅行先カタログ 56件。何度流しても同じ結果になる。
insert into public.spots (id, name, area, prefecture, region, lat, lng, category, tags, season_months, description, address, hours, price_yen, duration_min, access, vibe, is_partner, images, is_fictional) values
  ('hokkaido-otaru-kaisen-donburi', '運河ぞいの海鮮丼の店', '小樽', '北海道', 'hokkaido', 43.1937, 140.9907, 'food', array['海鮮', '郷土料理', '友人']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '朝に届いたネタをのせる海鮮丼の食堂。小樽運河から歩いてすぐで、観光の合間の昼ごはんにちょうどいい店です。', '北海道小樽市 色内 1-8-3（架空）', '11:00〜15:00（水曜定休）', 2800, 60, 'JR小樽駅から徒歩約10分', 1, false, '[]'::jsonb, true),
  ('hokkaido-otaru-unga-sanpo', '夕暮れの運河さんぽ', '小樽', '北海道', 'hokkaido', 43.1907, 140.9947, 'culture', array['夜景', '歴史', '街歩き']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '石造りの倉庫が並ぶ運河を、夕暮れから歩く散歩コース。ガス灯がともる時間は、ひとりでも友人とでも楽しめます。', '北海道小樽市 港町 5-4（架空）', '終日（散策自由）', 0, 90, 'JR小樽駅から徒歩約10分', 2, false, '[]'::jsonb, true),
  ('hokkaido-otaru-minato-yado', '港町の小さな湯宿 みなと荘', '小樽', '北海道', 'hokkaido', 43.1827, 141.0017, 'stay', array['温泉', '海鮮', '友人']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '港を見下ろす高台にある、客室8室の小さな宿。夕食に地元の魚が並び、静かに過ごしたい旅に向いています。', '北海道小樽市 オタモイ 2-17（架空）', 'チェックイン 15:00 / アウト 10:00', 16000, 960, 'JR小樽駅からバスで約15分', 3, false, '[]'::jsonb, true),
  ('hokkaido-otaru-glass-taiken', 'ガラス細工づくり体験', '小樽', '北海道', 'hokkaido', 43.1947, 141.0007, 'activity', array['体験', 'アート', '友人']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '小樽らしいガラスで、自分だけのグラスや小物をつくる約60分の体験。経験がなくても、スタッフが手順を教えてくれます。', '北海道小樽市 堺町 3-12（架空）', '10:00〜17:00（予約制）', 3800, 60, 'JR南小樽駅から徒歩約8分', 2, true, '[]'::jsonb, true),
  ('yamagata-ginzan-yukimi-buro', '雪見露天の宿 しろがね荘', '銀山温泉', '山形県', 'tohoku', 38.5713, 140.5301, 'onsen', array['温泉', '雪景色', '友人']::text[], array[11, 12, 1, 2, 3]::int[], '川沿いに立つ木造の小さな宿。雪を眺めながら入れる貸切の露天風呂があり、友人同士でゆっくり話したい夜に向いています。', '山形県尾花沢市銀山新畑 99-1（架空）', 'チェックイン 15:00 / アウト 10:00', 22000, 960, 'JR大石田駅からバスで約40分', 2, false, '[{"url":"https://images.unsplash.com/photo-1517918558653-3a2c5ab393a2?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900","credit":"","credit_url":""}]'::jsonb, true),
  ('yamagata-ginzan-soba-kawaoto', '銀山の手打ちそば 川音', '銀山温泉', '山形県', 'tohoku', 38.5733, 140.5271, 'food', array['郷土料理', '友人', '朝旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '川の音を聞きながら食べる、手打ちそばの食事処。山菜の天ぷらもあり、温泉街の昼ごはんに向いています。', '山形県尾花沢市銀山新畑 銀山新畑 120-3（架空）', '11:00〜15:00（木曜定休）', 1600, 60, '銀山温泉バス停から徒歩約3分', 2, false, '[]'::jsonb, true),
  ('yamagata-ginzan-gaito-sanpo', 'ガス灯の湯の街さんぽ', '銀山温泉', '山形県', 'tohoku', 38.5693, 140.5311, 'culture', array['夜景', '雪景色', '歴史']::text[], array[11, 12, 1, 2, 3]::int[], '木造の旅館が並ぶ川沿いを、ガス灯のともる夕方に歩きます。雪の夜は特に静かで、ひとりの散歩にも向いています。', '山形県尾花沢市銀山新畑 銀山新畑 1（架空）', '終日（散策自由）', 0, 60, '銀山温泉バス停から徒歩約2分', 2, false, '[]'::jsonb, true),
  ('yamagata-ginzan-yukiakari-photo', '雪あかりの写真さんぽ', '銀山温泉', '山形県', 'tohoku', 38.5753, 140.5341, 'activity', array['体験', '雪景色', 'ひとり旅']::text[], array[12, 1, 2]::int[], '写真が得意なガイドと、雪の温泉街をめぐる約90分の体験。スマホでもきれいに撮るコツを教えてもらえます。', '山形県尾花沢市銀山新畑 銀山新畑 45-2（架空）', '16:00〜（1日1回・予約制）', 4500, 90, '銀山温泉バス停から徒歩約3分', 4, true, '[]'::jsonb, true),
  ('yamagata-zao-juhyo-snowshoe', '樹氷の森スノーシュー体験', '蔵王', '山形県', 'tohoku', 38.1697, 140.4184, 'activity', array['雪景色', '体験', '絶景']::text[], array[12, 1, 2]::int[], 'ガイドと一緒に樹氷のあいだを歩く約2時間の体験。道具はすべて借りられるので、雪山がはじめてでも参加できます。', '山形県山形市蔵王温泉 1200-5（架空）', '9:30 / 13:00 の1日2回', 6800, 120, '蔵王温泉バスターミナルから徒歩約10分', 3, true, '[{"url":"https://images.unsplash.com/photo-1673751243582-6d3d33cf136d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900","credit":"","credit_url":""}]'::jsonb, true),
  ('yamagata-zao-yamanosachi', '蔵王の山の幸ごはん 木のぬくもり亭', '蔵王', '山形県', 'tohoku', 38.1657, 140.4214, 'food', array['郷土料理', '友人', '家族']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '山菜ときのこ、地元の米を使った定食の店。体が温まる鍋もあり、雪遊びのあとの食事に向いています。', '山形県山形市蔵王温泉 蔵王温泉 880（架空）', '11:00〜20:00（火曜定休）', 2200, 60, '蔵王温泉バスターミナルから徒歩約5分', 2, false, '[]'::jsonb, true),
  ('yamagata-zao-okama-view', '御釜を望む展望さんぽ', '蔵王', '山形県', 'tohoku', 38.1777, 140.4144, 'nature', array['絶景', '朝旅', '家族']::text[], array[5, 6, 7, 8, 9, 10]::int[], '火口湖を見下ろす高台までの短い散策コース。晴れた日は湖面の色が変わり、写真を撮りたい人に向いています。', '山形県山形市蔵王温泉 蔵王温泉 刈田峠（架空）', '8:30〜16:30（11月〜4月は閉鎖）', 600, 90, '蔵王温泉からバスで約40分', 4, false, '[]'::jsonb, true),
  ('yamagata-zao-iou-yu', '蔵王の硫黄泉 湯宿 みやま', '蔵王', '山形県', 'tohoku', 38.1727, 140.4234, 'stay', array['温泉', '友人', '家族']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '白く濁った硫黄の湯が自慢の、木造の湯宿。大浴場に加えて貸切の風呂もあり、ゆったり過ごしたい旅に向いています。', '山形県山形市蔵王温泉 蔵王温泉 702（架空）', 'チェックイン 15:00 / アウト 10:00', 14000, 960, '蔵王温泉バスターミナルから徒歩約7分', 2, false, '[]'::jsonb, true),
  ('yamagata-yamadera-ishidan', '雪の石段 朝のぼり', '山寺', '山形県', 'tohoku', 38.3128, 140.4372, 'culture', array['雪景色', '歴史', '朝旅']::text[], array[11, 12, 1, 2, 3]::int[], '朝いちばんの静かな石段をのぼる散歩コース。雪の積もった境内を、ゆっくり歩きたい人に向いています。', '山形県山形市山寺 4456（架空）', '6:00〜17:00', 500, 90, 'JR山寺駅から徒歩約5分', 2, false, '[{"url":"https://images.unsplash.com/photo-1610623757180-f5ec7090a07f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900","credit":"","credit_url":""}]'::jsonb, true),
  ('yamagata-yamadera-tama-konnyaku', '山寺の玉こんにゃく茶屋', '山寺', '山形県', 'tohoku', 38.3108, 140.4342, 'food', array['郷土料理', '友人', '家族']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '醤油でじっくり煮た玉こんにゃくが名物の茶屋。石段をのぼる前後に、あたたかい串を片手に休めます。', '山形県山形市山寺 山寺 4300（架空）', '9:00〜16:30（不定休）', 1200, 45, 'JR山寺駅から徒歩約3分', 1, false, '[]'::jsonb, true),
  ('yamagata-yamadera-ishidan-yado', '石段の麓の古民家宿', '山寺', '山形県', 'tohoku', 38.3158, 140.4412, 'stay', array['歴史', '友人', '朝旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '築100年ほどの民家を直した、一日2組だけの小さな宿。囲炉裏のある部屋で、朝の石段にそなえられます。', '山形県山形市山寺 山寺 4501（架空）', 'チェックイン 15:00 / アウト 10:00', 13000, 960, 'JR山寺駅から徒歩約8分', 4, false, '[]'::jsonb, true),
  ('yamagata-yamadera-shakyo-zazen', '朝の写経と座禅体験', '山寺', '山形県', 'tohoku', 38.3178, 140.4352, 'activity', array['体験', '歴史', '朝旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '静かな堂で、写経と座禅を約90分ほど体験します。作法は最初に教えてもらえるので、はじめてでも落ち着いて参加できます。', '山形県山形市山寺 山寺 4600（架空）', '7:00 / 9:00 の1日2回', 3000, 90, 'JR山寺駅から徒歩約7分', 3, true, '[]'::jsonb, true),
  ('kanagawa-hakone-yuba-gozen', '湯葉と地野菜の昼ごはん', '箱根', '神奈川県', 'kanto', 35.2296, 139.11, 'food', array['郷土料理', '友人', '家族']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], 'できたての湯葉と、地元の野菜を使った御膳の店。やさしい味つけで、湯めぐりの合間の昼食に向いています。', '神奈川県足柄下郡箱根町 湯本 600-4（架空）', '11:00〜15:00（木曜定休）', 2800, 60, '箱根湯本駅から徒歩約6分', 2, false, '[]'::jsonb, true),
  ('kanagawa-hakone-ashinoko-cruise', '芦ノ湖のゆったり遊覧', '箱根', '神奈川県', 'kanto', 35.2226, 139.099, 'nature', array['絶景', '家族', 'ひとり旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '湖の上を約40分かけてめぐる遊覧。晴れた日は富士山が見え、船の上でのんびりしたい人に向いています。', '神奈川県足柄下郡箱根町 元箱根 100（架空）', '9:30〜16:00（1時間に1便）', 1000, 40, '箱根町港から徒歩約3分', 1, false, '[]'::jsonb, true),
  ('kanagawa-hakone-seseragi-yado', '渓流ぞいの湯宿 せせらぎ', '箱根', '神奈川県', 'kanto', 35.2396, 139.103, 'stay', array['温泉', '友人', 'ひとり旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '渓流の音が聞こえる、客室12室の湯宿。部屋付きの露天風呂があり、静かにゆっくり過ごしたい二人旅にも向いています。', '神奈川県足柄下郡箱根町 塔ノ沢 55（架空）', 'チェックイン 15:00 / アウト 11:00', 26000, 960, '箱根湯本駅から徒歩約10分', 2, false, '[]'::jsonb, true),
  ('kanagawa-hakone-yosegi-coaster', '寄木細工のコースターづくり', '箱根', '神奈川県', 'kanto', 35.2266, 139.115, 'activity', array['体験', 'アート', '友人']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '色の違う木を組み合わせて、世界に一つのコースターをつくる約60分の体験。道具は貸し出しで、手ぶらで参加できます。', '神奈川県足柄下郡箱根町 畑宿 80（架空）', '10:00〜16:00（予約制）', 3500, 60, '箱根湯本駅からバスで約25分', 3, true, '[]'::jsonb, true),
  ('yamanashi-kawaguchiko-fuji-cafe', '富士を望む湖畔カフェ', '河口湖', '山梨県', 'kanto', 35.5127, 138.7637, 'food', array['絶景', 'カフェ', 'ひとり旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '大きな窓から冬の富士山が見えるカフェ。ひとりでも、友人とのおしゃべりにも向いています。', '山梨県南都留郡富士河口湖町 船津 800（架空）', '9:00〜17:00（水曜定休）', 1200, 60, '富士急行河口湖駅から徒歩約12分', 1, false, '[{"url":"https://images.unsplash.com/photo-1528164344705-47542687000d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900","credit":"","credit_url":""}]'::jsonb, true),
  ('yamanashi-kawaguchiko-asayake-sanpo', '湖畔の朝焼け散歩', '河口湖', '山梨県', 'kanto', 35.5217, 138.7677, 'nature', array['絶景', '朝旅', 'ひとり旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '夜明け前の湖のまわりを歩く散歩コース。空が赤く染まるころ、富士山のシルエットが浮かびます。', '山梨県南都留郡富士河口湖町 大石 2150（架空）', '終日（散策自由）', 0, 90, '河口湖駅からバスで約20分', 2, false, '[]'::jsonb, true),
  ('yamanashi-kawaguchiko-cottage', '湖畔の一棟貸しコテージ', '河口湖', '山梨県', 'kanto', 35.5057, 138.7577, 'stay', array['友人', '家族', '絶景']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '富士山を正面に望む、一日一組限定のコテージ。キッチン付きで、仲間と食材を持ち寄ってゆっくり過ごせます。', '山梨県南都留郡富士河口湖町 勝山 1500（架空）', 'チェックイン 15:00 / アウト 10:00', 28000, 960, '河口湖駅から車で約15分', 3, false, '[]'::jsonb, true),
  ('yamanashi-kawaguchiko-lake-sup', '湖でSUP体験', '河口湖', '山梨県', 'kanto', 35.5187, 138.7557, 'activity', array['体験', '絶景', '友人']::text[], array[5, 6, 7, 8, 9, 10]::int[], 'ボードの上に立って、穏やかな湖面を進む約2時間の体験。ウェットスーツは貸し出しで、はじめてでも安心です。', '山梨県南都留郡富士河口湖町 大石 600（架空）', '9:00 / 13:00 の1日2回', 6500, 120, '河口湖駅から車で約10分', 3, true, '[]'::jsonb, true),
  ('nagano-shibu-sotoyu', '九つの外湯めぐり', '渋温泉', '長野県', 'chubu', 36.7448, 138.4276, 'onsen', array['温泉', '街歩き', '友人']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '石畳の温泉街を歩きながら、小さな外湯を順番にめぐります。浴衣で歩く夜の街並みも楽しめます。', '長野県下高井郡山ノ内町 渋 2100（架空）', '6:00〜22:00', 1500, 180, '長野電鉄湯田中駅からバスで約10分', 2, false, '[{"url":"https://images.unsplash.com/photo-1673751243256-d744af8a4dda?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900","credit":"","credit_url":""}]'::jsonb, true),
  ('nagano-shibu-oyaki-do', '渋の郷土料理 おやき堂', '渋温泉', '長野県', 'chubu', 36.7418, 138.4296, 'food', array['郷土料理', '友人', '家族']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '野沢菜や山菜を包んだおやきを、囲炉裏でじっくり焼く店。素朴な味で、湯上がりの軽い食事に向いています。', '長野県下高井郡山ノ内町 渋 2230（架空）', '10:00〜17:00（水曜定休）', 1400, 45, '渋温泉バス停から徒歩約3分', 2, false, '[]'::jsonb, true),
  ('nagano-shibu-yuki-no-tanima', '雪の谷あいを歩く森さんぽ', '渋温泉', '長野県', 'chubu', 36.7528, 138.4326, 'nature', array['雪景色', '絶景', 'ひとり旅']::text[], array[11, 12, 1, 2, 3]::int[], '雪をかぶった木々のあいだを歩く、約1時間の遊歩道。足あとのない朝の森は、静かに歩きたい人に向いています。', '長野県下高井郡山ノ内町 平穏 1300（架空）', '終日（散策自由）', 0, 60, '渋温泉バス停からバスで約10分', 4, false, '[]'::jsonb, true),
  ('nagano-shibu-sakagura', '蔵元の利き酒体験', '渋温泉', '長野県', 'chubu', 36.7388, 138.4206, 'activity', array['体験', '友人', '夜景']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '地元の酒蔵で、数種類の日本酒を飲み比べる約60分の体験。蔵の人が味の違いを教えてくれ、お酒好きの友人旅に向いています。', '長野県下高井郡山ノ内町 渋 2400（架空）', '13:00〜17:00（予約制）', 3200, 60, '湯田中駅から徒歩約12分', 3, true, '[]'::jsonb, true),
  ('nagano-hakuba-yama-no-sachi', '白馬の山の幸定食', '白馬', '長野県', 'chubu', 36.695, 137.866, 'food', array['郷土料理', '友人', '家族']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '山菜やきのこ、地元のそばを組み合わせた定食の店。スキーのあとに食べる、あたたかい汁ものが人気です。', '長野県北安曇郡白馬村 北城 3020（架空）', '11:00〜20:00（水曜定休）', 2000, 60, '白馬駅から徒歩約8分', 2, false, '[]'::jsonb, true),
  ('nagano-hakuba-gondola-view', '雪山を望むゴンドラ散歩', '白馬', '長野県', 'chubu', 36.706, 137.856, 'nature', array['絶景', '雪景色', '家族']::text[], array[12, 1, 2, 3, 7, 8]::int[], 'ゴンドラで高台にのぼり、北アルプスを見渡す短い散策。冬は雪の山並み、夏は高原の緑が楽しめます。', '長野県北安曇郡白馬村 神城 2500（架空）', '8:30〜16:30（季節で変更）', 1000, 120, '白馬駅からバスで約15分', 1, false, '[]'::jsonb, true),
  ('nagano-hakuba-log-lodge', '雪原のログハウス宿', '白馬', '長野県', 'chubu', 36.691, 137.865, 'stay', array['友人', '家族', '雪景色']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '雪原に立つ丸太づくりの小さな宿。薪ストーブの暖かさが自慢で、仲間とにぎやかに過ごしたい旅に向いています。', '長野県北安曇郡白馬村 神城 3300（架空）', 'チェックイン 15:00 / アウト 10:00', 15000, 960, '白馬駅から車で約10分', 3, false, '[]'::jsonb, true),
  ('nagano-hakuba-first-snowboard', 'はじめてのスノーボード体験', '白馬', '長野県', 'chubu', 36.702, 137.855, 'activity', array['体験', '友人', '雪景色']::text[], array[12, 1, 2, 3]::int[], '道具とウェアを借りて、はじめてでも滑れるように教わる約3時間の体験。転び方から丁寧に教えてもらえます。', '長野県北安曇郡白馬村 北城 3100（架空）', '9:00 / 13:00 の1日2回', 8500, 180, '白馬駅からバスで約10分', 3, true, '[]'::jsonb, true),
  ('ishikawa-kanazawa-kaisen-kaga', '金沢の海鮮と加賀野菜ランチ', '金沢', '石川県', 'chubu', 36.5583, 136.6602, 'food', array['海鮮', '郷土料理', '友人']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '日本海の魚と、加賀野菜を使った小鉢が並ぶ昼ごはん。市場の近くにあり、食べ歩きの合間の昼食に向いています。', '石川県金沢市 近江町 40（架空）', '11:00〜15:00（水曜定休）', 3200, 60, 'JR金沢駅から徒歩約12分', 1, false, '[]'::jsonb, true),
  ('ishikawa-kanazawa-higashi-chaya', 'ひがし茶屋街の路地歩き', '金沢', '石川県', 'chubu', 36.5643, 136.6622, 'culture', array['歴史', '街歩き', 'アート']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '格子のある茶屋が続く石畳の街並みを歩きます。小さな工芸店やカフェに立ち寄れ、街歩きが好きな人に向いています。', '石川県金沢市 東山 1-13（架空）', '終日（散策自由）', 0, 120, 'JR金沢駅からバスで約15分', 2, false, '[]'::jsonb, true),
  ('ishikawa-kanazawa-machiya-yado', '町家の一棟貸し 加賀の宿', '金沢', '石川県', 'chubu', 36.5673, 136.6522, 'stay', array['歴史', '友人', 'ひとり旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '築100年の町家を直した、一日一組の宿。坪庭を眺めながら、ゆっくり夜を過ごしたい旅に向いています。', '石川県金沢市 主計町 3-8（架空）', 'チェックイン 15:00 / アウト 10:00', 20000, 960, 'JR金沢駅からバスで約12分', 3, false, '[]'::jsonb, true),
  ('ishikawa-kanazawa-kinpaku', '金箔貼り体験', '金沢', '石川県', 'chubu', 36.5563, 136.6502, 'activity', array['体験', 'アート', '友人']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '小さな皿や箸に金箔を貼って、自分だけの工芸品をつくる約50分の体験。細かい作業が好きな人に向いています。', '石川県金沢市 尾山町 2-7（架空）', '10:00〜16:30（予約制）', 3200, 50, 'JR金沢駅からバスで約10分', 2, true, '[]'::jsonb, true),
  ('gifu-shirakawago-gohei-mochi', '五平餅と山里ごはん', '白川郷', '岐阜県', 'chubu', 36.254, 136.909, 'food', array['郷土料理', '友人', '家族']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], 'みそだれをぬって焼く五平餅と、山菜の汁ものを出す店。合掌造りの集落を歩く途中の休憩に向いています。', '岐阜県大野郡白川村 荻町 2650（架空）', '10:00〜16:00（不定休）', 1500, 45, '白川郷バスターミナルから徒歩約8分', 2, false, '[]'::jsonb, true),
  ('gifu-shirakawago-tenbodai', '合掌集落を望む展望台', '白川郷', '岐阜県', 'chubu', 36.264, 136.911, 'nature', array['絶景', '雪景色', '歴史']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '集落全体を見下ろせる高台まで歩く、約30分の散策。雪の日は屋根が白くなり、写真を撮りたい人に向いています。', '岐阜県大野郡白川村 荻町 城山（架空）', '8:30〜17:00（冬は一部閉鎖）', 0, 60, '白川郷バスターミナルからシャトルバスで約10分', 1, false, '[]'::jsonb, true),
  ('gifu-shirakawago-gassho-stay', '合掌造りの民宿', '白川郷', '岐阜県', 'chubu', 36.251, 136.902, 'stay', array['歴史', '雪景色', '家族']::text[], array[11, 12, 1, 2, 3]::int[], '茅ぶき屋根の古い民家に泊まる、客室5室の宿。囲炉裏を囲んで夕食をとり、昔ながらの暮らしにふれられます。', '岐阜県大野郡白川村 荻町 2800（架空）', 'チェックイン 15:00 / アウト 10:00', 14000, 960, '白川郷バスターミナルから徒歩約10分', 3, false, '[]'::jsonb, true),
  ('gifu-shirakawago-wara-zaiku', 'わら細工づくり体験', '白川郷', '岐阜県', 'chubu', 36.261, 136.9, 'activity', array['体験', '歴史', '家族']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '集落で受け継がれてきた、わらを編む手仕事を約60分体験します。小さなかざりを持ち帰れ、家族連れにも向いています。', '岐阜県大野郡白川村 荻町 2700（架空）', '10:00〜16:00（予約制）', 3000, 60, '白川郷バスターミナルから徒歩約6分', 3, true, '[]'::jsonb, true),
  ('kyoto-arashiyama-yudofu-gozen', '嵐山の湯どうふ御膳', '嵐山', '京都府', 'kansai', 35.0124, 135.6708, 'food', array['郷土料理', '友人', 'ひとり旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '京都の水でつくる湯どうふを、季節の小鉢と味わう御膳。やさしい味で、散歩の途中のゆっくりした昼食に向いています。', '京都府京都市右京区嵯峨 嵯峨天龍寺 28（架空）', '11:00〜15:00（不定休）', 3000, 60, '嵐電嵐山駅から徒歩約5分', 1, false, '[]'::jsonb, true),
  ('kyoto-arashiyama-chikurin', '竹林の小径さんぽ', '嵐山', '京都府', 'kansai', 35.0154, 135.6638, 'nature', array['絶景', '朝旅', 'ひとり旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '背の高い竹が空へのびる、短い散歩道。人の少ない朝の時間は、木もれ日の揺れる音が楽しめます。', '京都府京都市右京区嵯峨 嵯峨小倉山 3（架空）', '終日（散策自由）', 0, 45, '嵐電嵐山駅から徒歩約8分', 1, false, '[]'::jsonb, true),
  ('kyoto-arashiyama-kawabe-yado', '川ぞいの小さな旅館 桂の宿', '嵐山', '京都府', 'kansai', 35.0044, 135.6608, 'stay', array['歴史', '友人', 'ひとり旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '桂川を見渡せる、客室10室の落ち着いた旅館。朝はお茶を飲みながら、川霧の景色をゆっくり眺められます。', '京都府京都市右京区嵯峨 嵯峨中又町 7（架空）', 'チェックイン 15:00 / アウト 10:00', 24000, 960, '嵐電嵐山駅から徒歩約10分', 3, false, '[]'::jsonb, true),
  ('kyoto-arashiyama-kimono-walk', '着物で歩く嵐山さんぽ', '嵐山', '京都府', 'kansai', 35.0054, 135.6728, 'activity', array['体験', '街歩き', '友人']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '着物のレンタルと着付けがついて、そのまま嵐山の街を歩ける約3時間の体験。写真が好きな友人旅に向いています。', '京都府京都市右京区嵯峨 嵯峨亀ノ尾町 14（架空）', '9:00〜17:00（予約制）', 5500, 180, '嵐電嵐山駅から徒歩約3分', 2, true, '[]'::jsonb, true),
  ('hyogo-kinosaki-kani-tajima', '城崎の海鮮と但馬牛ランチ', '城崎温泉', '兵庫県', 'kansai', 35.6267, 134.808, 'food', array['海鮮', '郷土料理', '友人']::text[], array[11, 12, 1, 2, 3]::int[], '冬は地元で揚がった魚介を、通年は但馬牛を味わえる店。温泉街の中心にあり、湯めぐりの合間の食事に向いています。', '兵庫県豊岡市城崎町 湯島 280（架空）', '11:30〜15:00（木曜定休）', 3600, 60, '城崎温泉駅から徒歩約8分', 2, false, '[]'::jsonb, true),
  ('hyogo-kinosaki-sotoyu', '城崎の外湯めぐり', '城崎温泉', '兵庫県', 'kansai', 35.6247, 134.811, 'onsen', array['温泉', '街歩き', '友人']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '柳並木の川ぞいを、浴衣でぶらぶら歩いて外湯をめぐります。お湯ごとに違う雰囲気を、順番に楽しめます。', '兵庫県豊岡市城崎町 湯島 100（架空）', '7:00〜23:00', 1500, 180, '城崎温泉駅から徒歩約7分', 1, false, '[]'::jsonb, true),
  ('hyogo-kinosaki-yanagi-sanpo', '柳並木の夕さんぽ', '城崎温泉', '兵庫県', 'kansai', 35.6277, 134.815, 'culture', array['夜景', '街歩き', '歴史']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '石の橋がかかる川ぞいを、夕暮れから歩く短い散歩。明かりのともる温泉街は、ひとりでも静かに歩けます。', '兵庫県豊岡市城崎町 湯島 90（架空）', '終日（散策自由）', 0, 45, '城崎温泉駅から徒歩約6分', 2, false, '[]'::jsonb, true),
  ('hyogo-kinosaki-mugiwara', '麦わら細工づくり体験', '城崎温泉', '兵庫県', 'kansai', 35.6207, 134.816, 'activity', array['体験', 'アート', '家族']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '麦わらを貼り合わせて、小さな箱やかざりをつくる約60分の体験。細かい作業を、おしゃべりしながら楽しめます。', '兵庫県豊岡市城崎町 湯島 450（架空）', '10:00〜16:00（予約制）', 3000, 60, '城崎温泉駅から徒歩約10分', 3, true, '[]'::jsonb, true),
  ('hiroshima-miyajima-anago-meshi', '穴子めしの食堂', '宮島', '広島県', 'chugoku_shikoku', 34.2991, 132.3158, 'food', array['郷土料理', '海鮮', '家族']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '炭火で焼いた穴子を、ご飯にのせたお弁当風の定食。桟橋の近くにあり、島に着いてすぐの昼ごはんに向いています。', '広島県廿日市市宮島町 宮島町 540（架空）', '10:00〜16:00（木曜定休）', 2600, 50, '宮島桟橋から徒歩約5分', 1, false, '[]'::jsonb, true),
  ('hiroshima-miyajima-misen-view', '弥山の展望さんぽ', '宮島', '広島県', 'chugoku_shikoku', 34.2901, 132.3238, 'nature', array['絶景', '島', '朝旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], 'ロープウェーと徒歩で、瀬戸内の島々を見渡す山頂へ。晴れた朝は海が光り、眺めを楽しみたい人に向いています。', '広島県廿日市市宮島町 宮島町 弥山（架空）', '9:00〜17:00（季節で変更）', 1000, 180, '宮島桟橋から徒歩約20分', 2, false, '[]'::jsonb, true),
  ('hiroshima-miyajima-shiokaze-yado', '海を望む宿 しおかぜ荘', '宮島', '広島県', 'chugoku_shikoku', 34.3021, 132.3258, 'stay', array['島', '友人', 'ひとり旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '部屋から瀬戸内の海が見える、客室9室の宿。夕日の時間は、窓辺で静かに過ごしたい人に向いています。', '広島県廿日市市宮島町 宮島町 330（架空）', 'チェックイン 15:00 / アウト 10:00', 18000, 960, '宮島桟橋から徒歩約12分', 3, false, '[]'::jsonb, true),
  ('hiroshima-miyajima-torii-kayak', '鳥居をめぐる朝のカヤック', '宮島', '広島県', 'chugoku_shikoku', 34.2961, 132.3198, 'activity', array['島', '体験', '朝旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '朝の穏やかな海を、ガイドと一緒に漕ぎ進みます。海に立つ鳥居を近くで見られる、約2時間の体験です。', '広島県廿日市市宮島町 宮島町 300-2（架空）', '8:00 / 10:30 の1日2回', 7200, 120, '宮島桟橋から徒歩約8分', 3, true, '[{"url":"https://images.unsplash.com/photo-1693246049389-9fecc67938c1?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900","credit":"","credit_url":""}]'::jsonb, true),
  ('fukuoka-itoshima-kaki-goya', '牡蠣小屋の浜焼きごはん', '糸島', '福岡県', 'kyushu', 33.554, 130.19, 'food', array['海鮮', '友人', '家族']::text[], array[12, 1, 2, 3]::int[], '海辺の小屋で、牡蠣や魚介を炭火で焼いて食べます。殻を開ける手伝いもあり、仲間とわいわい食べたい人に向いています。', '福岡県糸島市 加布里 3200（架空）', '10:00〜17:00（水曜定休）', 3500, 90, 'JR筑前前原駅からバスで約15分', 2, false, '[]'::jsonb, true),
  ('fukuoka-itoshima-futami-yuhi', '夫婦岩の夕日さんぽ', '糸島', '福岡県', 'kyushu', 33.565, 130.199, 'nature', array['絶景', '夜景', 'ひとり旅']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '海に立つ二つの岩を、夕日の時間に眺める短い散歩。空と海が染まる時間は、静かに眺めたい人に向いています。', '福岡県糸島市 二見ヶ浦 5（架空）', '終日（散策自由）', 0, 60, 'JR筑前前原駅からバスで約30分', 2, false, '[]'::jsonb, true),
  ('fukuoka-itoshima-umibe-villa', '海辺の一棟貸し', '糸島', '福岡県', 'kyushu', 33.549, 130.197, 'stay', array['絶景', '友人', '家族']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '目の前が海の、一日一組限定の貸し別荘。庭でバーベキューができ、仲間とゆっくり過ごしたい旅に向いています。', '福岡県糸島市 志摩小富士 700（架空）', 'チェックイン 15:00 / アウト 10:00', 30000, 960, 'JR筑前前原駅から車で約20分', 4, false, '[]'::jsonb, true),
  ('fukuoka-itoshima-umibe-tougei', '海辺の陶芸体験', '糸島', '福岡県', 'kyushu', 33.562, 130.189, 'activity', array['体験', 'アート', '友人']::text[], array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[], '地元の土を使って、ろくろでうつわをつくる約90分の体験。焼き上がった作品は、後日郵送してもらえます。', '福岡県糸島市 志摩師吉 1500（架空）', '10:00〜16:00（予約制）', 4200, 90, 'JR筑前前原駅から車で約15分', 3, true, '[]'::jsonb, true)
on conflict (id) do update set
  name = excluded.name,
  area = excluded.area,
  prefecture = excluded.prefecture,
  region = excluded.region,
  lat = excluded.lat,
  lng = excluded.lng,
  category = excluded.category,
  tags = excluded.tags,
  season_months = excluded.season_months,
  description = excluded.description,
  address = excluded.address,
  hours = excluded.hours,
  price_yen = excluded.price_yen,
  duration_min = excluded.duration_min,
  access = excluded.access,
  vibe = excluded.vibe,
  is_partner = excluded.is_partner,
  images = excluded.images,
  is_fictional = excluded.is_fictional;
