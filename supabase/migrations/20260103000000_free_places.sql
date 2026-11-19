-- たびおん：問12の自由入力（サイトにない場所）のための追加。20260102000000_stage3.sql のあとに流す。
-- すでに流した SQL は流し直さない（この1本だけを流す）。
--
-- 1. 外した「サイトにない場所」の記録（removed_free_places）。spot の id がないので、removed_spots には入れられない。
-- 2. save_plan を置き換える（create or replace。実行権限は、置き換えても元のまま）。
--    - spot_id が null の予定（source = 'user'）を、そのまま入れられる。
--    - source = 'user' の予定は、edited_by_user を true にして入れる（作り直しでも消さない）。
--    - spot_id が null の予定は、同じタイトルがすでにあれば足さない（作り直しで増えない）。
-- plan_items.spot_id は、もともと null を許している。RLS（plan_items の方針）は spot_id を見ないので、変更はいらない。

create table public.removed_free_places (
  trip_id uuid not null references public.trips on delete cascade,
  place_text text not null check (char_length(place_text) between 1 and 30),
  removed_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (trip_id, place_text)
);

alter table public.removed_free_places enable row level security;
grant select, insert, delete on public.removed_free_places to authenticated;
grant all on public.removed_free_places to service_role;
create policy removed_free_places_select on public.removed_free_places for select to authenticated using (public.is_trip_member(trip_id));
create policy removed_free_places_insert on public.removed_free_places for insert to authenticated with check (public.is_trip_member(trip_id));
create policy removed_free_places_delete on public.removed_free_places for delete to authenticated using (public.is_trip_member(trip_id));

create or replace function public.save_plan(
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
  v_spot text;
  v_source text;
begin
  perform 1 from public.trips t where t.id = p_trip_id for update;
  if not found then raise exception 'trip_not_found'; end if;

  delete from public.plan_items
  where trip_id = p_trip_id and coalesce(pinned, false) = false and coalesce(edited_by_user, false) = false;

  for r in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_spot := r ->> 'spot_id';
    v_source := coalesce(r ->> 'source', p_source);
    if v_spot is not null then
      continue when exists (select 1 from public.plan_items i where i.trip_id = p_trip_id and i.spot_id = v_spot);
    else
      -- サイトにない場所：同じタイトルがすでにあれば足さない
      continue when exists (select 1 from public.plan_items i where i.trip_id = p_trip_id and i.spot_id is null and i.title = r ->> 'title');
    end if;
    v_day := (r ->> 'day')::int;
    select coalesce(max(i.position), 0) + 1 into v_pos from public.plan_items i where i.trip_id = p_trip_id and i.day = v_day;
    insert into public.plan_items (trip_id, day, position, spot_id, title, time_hint, pinned, edited_by_user, source)
    values (p_trip_id, v_day, v_pos, v_spot, r ->> 'title', r ->> 'time_hint', false, v_source = 'user', v_source);
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

  if p_actor_member_id is not null then
    update public.members set last_seen_plan_version = v_version where id = p_actor_member_id and trip_id = p_trip_id;
  end if;
  return v_version;
end;
$$;
