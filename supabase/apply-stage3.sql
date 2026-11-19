-- 自動生成：scripts/build-sql.mjs。段階2までの SQL（setup.sql）をすでに流しているときに、SQL Editor へ貼って Run する1本。
-- 初めて Supabase を使うときは、これではなく setup.sql を貼る（setup.sql にはこの内容も入っている）。

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
