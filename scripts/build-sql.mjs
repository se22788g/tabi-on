// supabase/seed/spots.json から seed の SQL を作り、SQL Editor に貼る1本のファイルにまとめる。
// 使い方: pnpm db:sql   （キーは要らない）
// できるもの:
//   supabase/seed/spots.sql  … spots 56件の insert（何度流しても同じ結果になる upsert）
//   supabase/setup.sql       … migrations の SQL ＋ seed。SQL Editor にこれ1つを貼る
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const spots = JSON.parse(readFileSync(join(root, "supabase/seed/spots.json"), "utf8"));

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const textArr = (a) => `array[${a.map(q).join(", ")}]::text[]`;
const intArr = (a) => `array[${a.join(", ")}]::int[]`;
const num = (v) => (v === null || v === undefined ? "null" : String(v));

const cols = "id, name, area, prefecture, region, lat, lng, category, tags, season_months, description, address, hours, price_yen, duration_min, access, vibe, is_partner, images, is_fictional";
const rows = spots.map(
  (s) =>
    `  (${[
      q(s.id), q(s.name), q(s.area), q(s.prefecture), q(s.region), num(s.lat), num(s.lng), q(s.category),
      textArr(s.tags), intArr(s.season_months), q(s.description), q(s.address), q(s.hours),
      num(s.price_yen), num(s.duration_min), q(s.access), num(s.vibe), s.is_partner ? "true" : "false",
      `${q(JSON.stringify(s.images))}::jsonb`, s.is_fictional ? "true" : "false",
    ].join(", ")})`,
);
const update = cols
  .split(", ")
  .filter((c) => c !== "id")
  .map((c) => `${c} = excluded.${c}`)
  .join(",\n  ");
const seed = `-- 自動生成：scripts/build-sql.mjs（元データ：supabase/seed/spots.json）。手で直さない。
-- 架空の旅行先カタログ ${spots.length}件。何度流しても同じ結果になる。
insert into public.spots (${cols}) values
${rows.join(",\n")}
on conflict (id) do update set
  ${update};
`;
writeFileSync(join(root, "supabase/seed/spots.sql"), seed);

const migrationDir = join(root, "supabase/migrations");
const migrations = readdirSync(migrationDir).filter((f) => f.endsWith(".sql")).sort();
const setup =
  `-- 自動生成：scripts/build-sql.mjs。Supabase の SQL Editor に、このファイルを1つだけ貼って Run する。\n` +
  `-- 中身：${migrations.join("、")} ＋ seed/spots.sql（初回だけ流す）\n\n` +
  migrations.map((f) => `-- ===== migrations/${f} =====\n${readFileSync(join(migrationDir, f), "utf8")}`).join("\n") +
  `\n-- ===== seed/spots.sql =====\n${seed}`;
writeFileSync(join(root, "supabase/setup.sql"), setup);
console.log(`spots.sql（${spots.length}件）と setup.sql を作りました`);
