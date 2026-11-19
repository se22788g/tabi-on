-- たびおん 段階6：Supabase Realtime（工程案の変更・参加状況を、開いている人の画面に届ける）。
-- 20260103000000_free_places.sql のあとに流す。すでに流した SQL は流し直さない（この1本だけを流す）。
--
-- Realtime は、テーブルの変更を、RLS を通した上で、その行を読める人にだけ届ける。
-- 届けるテーブル：plans（工程案の version）、plan_items（予定）、members（参加状況・度合いを終えたか）。
-- replica identity full：削除の通知にも、trip_id（絞り込みの列）が入るようにする（外した予定が、開いている人の画面から消えるように）。
-- ratings・answers・candidates は、届けない（ほかの人の度合いを、通知として流さないため）。
-- 何度流しても壊れないよう、すでに入っていれば何もしない。

alter table public.plans replica identity full;
alter table public.plan_items replica identity full;
alter table public.members replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['plans', 'plan_items', 'members'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
