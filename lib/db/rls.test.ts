// supabase/setup.sql（テーブル・権限・seed）を、ローカルの Postgres（PGlite）で実際に流して確かめる。
// Supabase 側の auth スキーマとロール（anon / authenticated / service_role）は、同じ形のものを作って代用する。
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-0000-0000-00000000000a"; // 言い出し役
const B = "00000000-0000-0000-0000-00000000000b"; // 参加者
const C = "00000000-0000-0000-0000-00000000000c"; // 無関係の人

let db: PGlite;

/** 指定したロール・ユーザーとして SQL を流す。権限エラーは例外で返す */
async function as(role: "anon" | "authenticated" | "service_role", uid: string | null, sql: string) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role }) : ""]);
  try {
    const r = await db.query(sql);
    return r.rows as Record<string, unknown>[];
  } finally {
    await db.exec("reset role");
  }
}
const fails = async (p: Promise<unknown>) => {
  try {
    await p;
    return false;
  } catch {
    return true;
  }
};

let tripId = "";
let memberA = "";
let memberB = "";
let cand = "";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create publication supabase_realtime;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users values ('${A}'), ('${B}'), ('${C}');
  `);
  await db.exec(readFileSync("supabase/setup.sql", "utf8"));

  // 旅・メンバー・おすすめを用意する（おすすめはサーバー＝service_role が作る）
  const t = await as("authenticated", A, `insert into public.trips (code, owner_id, companion) values ('TABI-TEST', '${A}', 'friends') returning id`);
  tripId = t[0].id as string;
  const ma = await as("authenticated", A, `insert into public.members (trip_id, name, user_id, is_owner) values ('${tripId}', 'あや', '${A}', true) returning id`);
  memberA = ma[0].id as string;
  const mb = await as("authenticated", A, `insert into public.members (trip_id, name) values ('${tripId}', 'みさき') returning id`);
  memberB = mb[0].id as string;
  // 参加時に、サーバーが user_id を入れる
  await as("service_role", null, `update public.members set user_id = '${B}' where id = '${memberB}'`);
  const c = await as(
    "service_role", null,
    `insert into public.candidates (trip_id, title, area_label, spot_ids, tags, source)
     values ('${tripId}', '雪と温泉の旅', '山形・銀山温泉', array['yamagata-ginzan-yukimi-buro','yamagata-zao-juhyo-snowshoe'], array['温泉'], 'rule') returning id`,
  );
  cand = c[0].id as string;
}, 60000);

afterAll(async () => {
  await db.close();
});

describe("seed", () => {
  it("spots が56件入る", async () => {
    const r = await as("service_role", null, "select count(*)::int as n from public.spots");
    expect(r[0].n).toBe(56);
  });
  it("流し直しても56件のまま（upsert）", async () => {
    const seed = readFileSync("supabase/seed/spots.sql", "utf8");
    await db.exec(seed);
    const r = await as("service_role", null, "select count(*)::int as n from public.spots");
    expect(r[0].n).toBe(56);
  });
});

describe("spots：誰でも読めて、誰も書けない", () => {
  it("ログイン前（anon）でも読める", async () => {
    const r = await as("anon", null, "select count(*)::int as n from public.spots");
    expect(r[0].n).toBe(56);
  });
  it("anon も authenticated も書けない", async () => {
    expect(await fails(as("anon", null, "delete from public.spots"))).toBe(true);
    expect(await fails(as("authenticated", A, "update public.spots set name = 'x'"))).toBe(true);
    expect(await fails(as("authenticated", A, "insert into public.spots (id,name,area,prefecture,region,category,tags,season_months,description,images) values ('x-y','n','a','p','kanto','food','{}','{}','d','[]')"))).toBe(true);
  });
});

describe("ログイン前（anon）は、spots 以外に触れない", () => {
  for (const t of ["trips", "members", "answers", "ratings", "candidates", "plans", "plan_items", "visits", "ai_cache", "profiles"]) {
    it(t, async () => {
      expect(await fails(as("anon", null, `select * from public.${t}`))).toBe(true);
    });
  }
});

describe("trips / members：同じ旅のメンバーだけ", () => {
  it("言い出し役も参加者も旅を読める。無関係の人は読めない", async () => {
    expect(await as("authenticated", A, "select id from public.trips")).toHaveLength(1);
    expect(await as("authenticated", B, "select id from public.trips")).toHaveLength(1);
    expect(await as("authenticated", C, "select id from public.trips")).toHaveLength(0);
  });
  it("メンバー一覧も同じ", async () => {
    expect(await as("authenticated", B, "select id from public.members")).toHaveLength(2);
    expect(await as("authenticated", C, "select id from public.members")).toHaveLength(0);
  });
  it("旅を作れるのは、自分が owner のときだけ", async () => {
    expect(await fails(as("authenticated", C, `insert into public.trips (code, owner_id) values ('TABI-EVIL', '${A}')`))).toBe(true);
  });
  it("owner でない人は、旅を変えられず、メンバーを足せない", async () => {
    expect(await as("authenticated", B, `update public.trips set status = 'decided' where id = '${tripId}' returning id`)).toHaveLength(0);
    expect(await fails(as("authenticated", B, `insert into public.members (trip_id, name) values ('${tripId}', 'しのび')`))).toBe(true);
    expect(await fails(as("authenticated", C, `insert into public.members (trip_id, name) values ('${tripId}', 'しのび')`))).toBe(true);
  });
  it("自分の user_id や is_owner は、ブラウザから書き換えられない", async () => {
    expect(await fails(as("authenticated", B, `update public.members set user_id = '${C}' where id = '${memberB}'`))).toBe(true);
    expect(await fails(as("authenticated", B, `update public.members set is_owner = true where id = '${memberB}'`))).toBe(true);
  });
  it("本人は、自分の answered_at を更新できる。ほかの人の行は更新できない", async () => {
    expect(await as("authenticated", B, `update public.members set answered_at = now() where id = '${memberB}' returning id`)).toHaveLength(1);
    // B は owner ではないので、A の行は 0 行（更新されない）
    expect(await as("authenticated", B, `update public.members set answered_at = now() where id = '${memberA}' returning id`)).toHaveLength(0);
  });
});

describe("answers：本人だけ", () => {
  it("本人は書ける・読める。同じ旅の別の人（言い出し役も）には見えない", async () => {
    await as("authenticated", B, `insert into public.answers (member_id, question_id, value) values ('${memberB}', 'pace', '4')`);
    expect(await as("authenticated", B, "select * from public.answers")).toHaveLength(1);
    expect(await as("authenticated", A, "select * from public.answers")).toHaveLength(0);
    expect(await as("authenticated", C, "select * from public.answers")).toHaveLength(0);
  });
  it("他人の member_id では書けない", async () => {
    expect(await fails(as("authenticated", C, `insert into public.answers (member_id, question_id, value) values ('${memberB}', 'pace', '1')`))).toBe(true);
  });
});

describe("ratings：ほかの人の分は直接読めない", () => {
  it("本人は付けられ、自分の分だけ読める", async () => {
    await as("authenticated", A, `insert into public.ratings (member_id, candidate_id, level) values ('${memberA}', '${cand}', 4)`);
    await as("authenticated", B, `insert into public.ratings (member_id, candidate_id, level) values ('${memberB}', '${cand}', 0)`);
    expect(await as("authenticated", A, "select level from public.ratings")).toEqual([{ level: 4 }]);
    expect(await as("authenticated", B, "select level from public.ratings")).toEqual([{ level: 0 }]);
    expect(await as("authenticated", C, "select level from public.ratings")).toHaveLength(0);
  });
  it("他人の分は付けられない。範囲外の値も付けられない", async () => {
    expect(await fails(as("authenticated", B, `insert into public.ratings (member_id, candidate_id, level) values ('${memberA}', '${cand}', 1)`))).toBe(true);
    expect(await fails(as("authenticated", B, `update public.ratings set level = 9 where member_id = '${memberB}'`))).toBe(true);
  });
  it("service_role は集計できる（名前を外した配列）", async () => {
    const r = await as("service_role", null, `select array_agg(level order by level desc) as levels from public.ratings where candidate_id = '${cand}'`);
    expect(r[0].levels).toEqual([4, 0]);
  });
});

describe("candidates / plans / plan_items", () => {
  it("おすすめは、同じ旅のメンバーだけが読める。ブラウザからは書けない", async () => {
    expect(await as("authenticated", B, "select id from public.candidates")).toHaveLength(1);
    expect(await as("authenticated", C, "select id from public.candidates")).toHaveLength(0);
    expect(await fails(as("authenticated", A, `insert into public.candidates (trip_id, title, area_label, spot_ids, tags, source) values ('${tripId}','x','y','{}','{}','rule')`))).toBe(true);
  });
  it("plans はメンバーが読めて、ブラウザからは書けない", async () => {
    await as("service_role", null, `insert into public.plans (trip_id, title, source) values ('${tripId}', '冬の山形', 'rule')`);
    expect(await as("authenticated", B, "select title from public.plans")).toHaveLength(1);
    expect(await as("authenticated", C, "select title from public.plans")).toHaveLength(0);
    expect(await fails(as("authenticated", A, `update public.plans set version = 99`))).toBe(true);
  });
  it("plan_items は、メンバー全員が読み書きできる。無関係の人はできない", async () => {
    await as("authenticated", B, `insert into public.plan_items (trip_id, day, position, spot_id, title, source) values ('${tripId}', 1, 1, 'yamagata-ginzan-yukimi-buro', '雪見露天風呂', 'user')`);
    expect(await as("authenticated", A, "select id from public.plan_items")).toHaveLength(1);
    expect(await as("authenticated", A, `update public.plan_items set position = 2, edited_by_user = true returning id`)).toHaveLength(1);
    expect(await as("authenticated", C, "select id from public.plan_items")).toHaveLength(0);
    expect(await fails(as("authenticated", C, `insert into public.plan_items (trip_id, day, position, title, source) values ('${tripId}', 1, 9, 'x', 'user')`))).toBe(true);
    expect(await as("authenticated", C, `delete from public.plan_items returning id`)).toHaveLength(0);
  });
});

describe("visits / ai_cache / profiles：本人だけ", () => {
  it("visits", async () => {
    await as("authenticated", A, `insert into public.visits (user_id, spot_id, again) values ('${A}', 'yamagata-yamadera-ishidan', true)`);
    expect(await as("authenticated", A, "select * from public.visits")).toHaveLength(1);
    expect(await as("authenticated", B, "select * from public.visits")).toHaveLength(0);
    expect(await fails(as("authenticated", B, `insert into public.visits (user_id, spot_id) values ('${A}', 'yamagata-yamadera-ishidan')`))).toBe(true);
  });
  it("ai_cache", async () => {
    await as("authenticated", A, `insert into public.ai_cache (user_id, kind, payload, input_hash) values ('${A}', 'home', '{}', 'h')`);
    expect(await as("authenticated", B, "select * from public.ai_cache")).toHaveLength(0);
    expect(await fails(as("authenticated", B, `insert into public.ai_cache (user_id, kind, payload, input_hash) values ('${A}', 'tendency', '{}', 'h')`))).toBe(true);
  });
  it("profiles", async () => {
    await as("authenticated", A, `insert into public.profiles (id, display_name) values ('${A}', 'あや')`);
    expect(await as("authenticated", B, "select * from public.profiles")).toHaveLength(0);
    expect(await fails(as("authenticated", B, `insert into public.profiles (id) values ('${A}')`))).toBe(true);
  });
});
