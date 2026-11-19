// 段階3のSQL（旅づくり・参加・工程案・ほかの人の度合いの隠し方）を、ローカルの Postgres（PGlite）で確かめる。
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-0000-0000-00000000000a"; // 言い出し役
const B = "00000000-0000-0000-0000-00000000000b"; // 参加者
const C = "00000000-0000-0000-0000-00000000000c"; // 無関係の人

let db: PGlite;
type Row = Record<string, unknown>;

async function as(role: "anon" | "authenticated" | "service_role", uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role }) : ""]);
  try {
    return (await db.query(sql, params)).rows as Row[];
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
const one = async (role: "anon" | "authenticated" | "service_role", uid: string | null, sql: string, params: unknown[] = []) =>
  (await as(role, uid, sql, params))[0];

let tripId = "";
let code = "";
let memberA = "";
let memberB = "";
let cands: string[] = [];

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
}, 60000);
afterAll(async () => {
  await db.close();
});

describe("旅をつくる（create_trip）", () => {
  it("旅・言い出し役・一緒に行く人ができる。コードは TABI-＋4文字（0 O 1 I L なし）", async () => {
    const r = await one(
      "authenticated", A,
      `select public.create_trip($1, 'friends', '{1,2}', '1', '東京都', '{tohoku}', 'yamagata-ginzan-yukimi-buro', $2) as r`,
      ["あや", ["みさき", "みさき", "けんた"]],
    );
    const j = r.r as { trip_id: string; code: string; member_id: string };
    tripId = j.trip_id;
    code = j.code;
    memberA = j.member_id;
    expect(code).toMatch(/^TABI-[2-9A-HJKMNP-Z]{4}$/);
    const names = (await as("authenticated", A, "select name, is_owner, user_id from public.members order by seq")).map((m) => m.name);
    expect(names).toEqual(["あや", "みさき", "みさき（2）", "けんた"]); // 同じ名前は（2）で分ける
    const t = await one("authenticated", A, "select companion, nights, origin, seed_spot_id from public.trips");
    expect(t).toMatchObject({ companion: "friends", nights: "1", origin: "東京都", seed_spot_id: "yamagata-ginzan-yukimi-buro" });
  });
  it("名前を空にすると「わたし」。12人を超えると作れない。ログインしていないと作れない", async () => {
    const r = await one("authenticated", C, `select public.create_trip('', 'solo', '{}', 'day', null, '{}', null, '{}') as r`);
    const id = (r.r as { trip_id: string }).trip_id;
    expect((await one("authenticated", C, "select name from public.members where trip_id = $1", [id])).name).toBe("わたし");
    const many = Array.from({ length: 12 }, (_, i) => `n${i}`);
    expect(await fails(as("authenticated", C, `select public.create_trip('x', 'friends', '{}', 'day', null, '{}', null, $1)`, [many]))).toBe(true);
    expect(await fails(as("anon", null, `select public.create_trip('x', 'friends', '{}', 'day', null, '{}', null, '{}')`))).toBe(true);
  });
  it("出発地は profiles に覚えられる", async () => {
    expect((await one("authenticated", A, "select origin from public.profiles")).origin).toBe("東京都");
  });
});

describe("招待（get_invite）と参加（join_trip）", () => {
  it("ログイン前でも、コードで招待の中身が見える。コードが違えば null", async () => {
    const r = (await one("anon", null, "select public.get_invite($1) as r", [code.toLowerCase()])).r as Record<string, unknown>;
    expect(r.owner_name).toBe("あや");
    expect(r.member_count).toBe(4);
    expect((r.members as { joined: boolean }[]).filter((m) => !m.joined)).toHaveLength(3);
    expect(r.member_id).toBeNull();
    expect((await one("anon", null, "select public.get_invite('TABI-ZZZZ') as r")).r).toBeNull();
  });
  it("名前を選んで参加できる。同じ名前に2人は入れない", async () => {
    const inv = (await one("anon", null, "select public.get_invite($1) as r", [code])).r as { members: { id: string; name: string }[] };
    memberB = inv.members.find((m) => m.name === "みさき")!.id;
    const j = (await one("authenticated", B, "select public.join_trip($1, $2, null) as r", [code, memberB])).r as Record<string, unknown>;
    expect(j).toMatchObject({ trip_id: tripId, member_id: memberB, already: false });
    expect(await fails(as("authenticated", C, "select public.join_trip($1, $2, null)", [code, memberB]))).toBe(true);
  });
  it("参加済みの端末で開くと、続きの情報が返る（already）", async () => {
    const j = (await one("authenticated", B, "select public.join_trip($1, null, null) as r", [code])).r as Record<string, unknown>;
    expect(j).toMatchObject({ member_id: memberB, already: true });
    const inv = (await one("authenticated", B, "select public.get_invite($1) as r", [code])).r as Record<string, unknown>;
    expect(inv).toMatchObject({ trip_id: tripId, member_id: memberB });
  });
  it("リストにない名前で参加できる（重なれば（2））。参加すると旅が読める", async () => {
    const j = (await one("authenticated", C, "select public.join_trip($1, null, 'あや') as r", [code])).r as { member_id: string };
    expect((await one("authenticated", C, "select name from public.members where id = $1", [j.member_id])).name).toBe("あや（2）");
    expect(await as("authenticated", C, "select id from public.trips")).toHaveLength(2); // 自分の旅（solo）と、参加した旅
  });
  it("コードが違う・名前が長すぎるときは参加できない", async () => {
    expect(await fails(as("authenticated", B, "select public.join_trip('TABI-ZZZZ', null, 'x')"))).toBe(true);
    const D = "00000000-0000-0000-0000-00000000000d";
    await db.exec(`insert into auth.users values ('${D}')`);
    expect(await fails(as("authenticated", D, "select public.join_trip($1, null, '12345678901')", [code]))).toBe(true);
  });
});

describe("工程案：保存・保持・ほかの人の度合いの隠し方", () => {
  const spots = ["yamagata-ginzan-yukimi-buro", "yamagata-zao-juhyo-snowshoe", "yamagata-yamadera-ishidan", "nagano-shibu-sotoyu"];
  const items = (list: { day: number; spot: string }[]) =>
    JSON.stringify(list.map((x, i) => ({ day: x.day, spot_id: x.spot, title: `予定${i}`, time_hint: "10:00", source: "rule" })));

  beforeAll(async () => {
    // おすすめ2件（サーバーが作る）
    const c1 = await one("service_role", null, `insert into public.candidates (trip_id, title, area_label, spot_ids, tags, source)
      values ($1, 'A', '山形', $2, '{}', 'rule') returning id`, [tripId, [spots[0], spots[1]]]);
    const c2 = await one("service_role", null, `insert into public.candidates (trip_id, title, area_label, spot_ids, tags, source)
      values ($1, 'B', '長野', $2, '{}', 'rule') returning id`, [tripId, [spots[3], spots[1]]]);
    cands = [c1.id as string, c2.id as string];
  });

  it("save_plan は、サーバー（service_role）だけが呼べる", async () => {
    expect(await fails(as("authenticated", A, `select public.save_plan($1, 't', 'rule', 'r', '[]'::jsonb, null)`, [tripId]))).toBe(true);
    expect(await fails(as("anon", null, `select public.save_plan($1, 't', 'rule', 'r', '[]'::jsonb, null)`, [tripId]))).toBe(true);
  });
  it("candidate_stats もサーバーだけ", async () => {
    expect(await fails(as("authenticated", A, "select * from public.candidate_stats($1)", [tripId]))).toBe(true);
  });

  it("工程案を保存する。version は1、作った本人は更新を見たことになる", async () => {
    const v = (await one("service_role", null, `select public.save_plan($1, '冬の山形', 'rule', '1人目の回答で更新しました', $2::jsonb, $3) as v`, [
      tripId, items([{ day: 1, spot: spots[0] }, { day: 1, spot: spots[1] }, { day: 2, spot: spots[2] }]), memberA,
    ])).v;
    expect(v).toBe(1);
    const pv = (await one("authenticated", A, "select public.plan_view($1) as r", [tripId])).r as { plan: { version: number; title: string }; items: { day: number; position: number }[]; me: { last_seen_plan_version: number } };
    expect(pv.plan.version).toBe(1);
    expect(pv.me.last_seen_plan_version).toBe(1);
    expect(pv.items.map((i) => [i.day, i.position])).toEqual([[1, 1], [1, 2], [2, 1]]);
  });

  it("自分が選ぶ前は、ほかの人の度合いが返らない（levels は空、avg は null）", async () => {
    await as("authenticated", A, `insert into public.ratings (member_id, candidate_id, level) values ($1, $2, 4)`, [memberA, cands[0]]);
    await as("authenticated", B, `insert into public.ratings (member_id, candidate_id, level) values ($1, $2, 3)`, [memberB, cands[0]]);
    // どちらも rated_at がまだ → 何も見えない
    for (const uid of [A, B]) {
      const pv = (await one("authenticated", uid, "select public.plan_view($1) as r", [tripId])).r as { items: { levels: number[]; avg: number | null }[]; candidate_spots: { avg: number | null }[] };
      for (const i of pv.items) {
        expect(i.levels).toEqual([]);
        expect(i.avg).toBeNull();
      }
      for (const s of pv.candidate_spots) expect(s.avg).toBeNull();
      // 自分の member_id は返るが、ほかの人のは返らない
      expect(JSON.stringify(pv)).not.toContain(uid === A ? memberB : memberA);
    }
  });
  it("自分が rated_at を持つと、名前なしの配列（高い順）が返る。member_id は返らない", async () => {
    await as("authenticated", A, "update public.members set rated_at = now() where id = $1", [memberA]);
    const pv = (await one("authenticated", A, "select public.plan_view($1) as r", [tripId])).r as { items: { spot_id: string; levels: number[]; avg: number }[]; rated_count: number };
    const ginzan = pv.items.find((i) => i.spot_id === spots[0])!;
    expect(ginzan.levels).toEqual([4, 3]);
    expect(ginzan.avg).toBe(3.5);
    expect(pv.rated_count).toBe(1);
    expect(JSON.stringify(pv)).not.toContain(memberB);
    // B はまだ rated_at がないので、見えないまま
    const pvB = (await one("authenticated", B, "select public.plan_view($1) as r", [tripId])).r as { items: { levels: number[] }[] };
    expect(pvB.items.every((i) => i.levels.length === 0)).toBe(true);
  });
  it("メンバーでない人は工程案を見られない", async () => {
    const D = "00000000-0000-0000-0000-00000000000d";
    expect(await fails(as("authenticated", D, "select public.plan_view($1)", [tripId]))).toBe(true);
  });

  it("candidate_stats は、おすすめごとの合計・最小・人数（member_id なし）", async () => {
    await as("authenticated", B, `insert into public.ratings (member_id, candidate_id, level) values ($1, $2, 0) on conflict do nothing`, [memberB, cands[1]]);
    const rows = await as("service_role", null, "select * from public.candidate_stats($1) order by level_sum desc", [tripId]);
    expect(rows).toEqual([
      { candidate_id: cands[0], level_sum: 7, level_min: 3, level_count: 2 },
      { candidate_id: cands[1], level_sum: 0, level_min: 0, level_count: 1 },
    ]);
  });

  it("作り直しても、pinned と edited_by_user の予定は、同じ日・同じ位置に残る", async () => {
    // 1日目の2番目を絶対行く、2日目の予定を手で並べ替えた扱いにする
    await as("authenticated", B, "update public.plan_items set pinned = true where spot_id = $1", [spots[1]]);
    await as("authenticated", B, "update public.plan_items set edited_by_user = true where spot_id = $1", [spots[2]]);
    const before = await as("service_role", null, "select spot_id, day, position from public.plan_items where pinned or edited_by_user order by spot_id");
    const v = (await one("service_role", null, `select public.save_plan($1, '作り直し', 'rule', '2人目の回答で更新しました', $2::jsonb, $3) as v`, [
      tripId,
      // 新しい案に、残る2件と同じ場所（重複）と、新しい場所を入れる。蔵王は2日目にしてあるが、元の日（1日目）に残るはず
      items([{ day: 2, spot: spots[1] }, { day: 1, spot: spots[3] }, { day: 1, spot: spots[2] }]),
      memberB,
    ])).v;
    expect(v).toBe(2);
    const after = await as("service_role", null, "select spot_id, day, position, source from public.plan_items order by day, position");
    for (const b of before) expect(after.find((a) => a.spot_id === b.spot_id)).toMatchObject({ day: b.day, position: b.position });
    // 消された予定（銀山）は戻り、重複は足されない
    expect(after.filter((a) => a.spot_id === spots[1])).toHaveLength(1);
    expect(after.filter((a) => a.spot_id === spots[2])).toHaveLength(1);
    expect(after.map((a) => a.spot_id)).toContain(spots[3]);
    expect(after.map((a) => a.spot_id)).not.toContain(spots[0]); // 手を入れていない予定は、新しい案に入っていなければ消える
    const plan = await one("service_role", null, "select version, title, updated_reason from public.plans");
    expect(plan).toMatchObject({ version: 2, title: "作り直し", updated_reason: "2人目の回答で更新しました" });
  });

  it("手で直したあとの並び順は、作り直しで入れ替わらない", async () => {
    // 1日目：蔵王（pinned, 位置1）→ 山寺（edited, 位置?）…の並びを手で入れ替えたあと、もう一度作り直す
    const day = await as("service_role", null, "select id, spot_id, position from public.plan_items where day = 1 order by position");
    const ids = day.map((d) => d.id as string);
    // 位置を反転して、すべて edited_by_user にする（M3 のドラッグと同じ）
    for (let i = 0; i < ids.length; i++) {
      await as("authenticated", A, "update public.plan_items set position = $2, edited_by_user = true where id = $1", [ids[i], ids.length - i]);
    }
    const reversed = await as("service_role", null, "select spot_id from public.plan_items where day = 1 order by position");
    await one("service_role", null, `select public.save_plan($1, 'また作り直し', 'rule', '3人目の回答で更新しました', $2::jsonb, null)`, [
      tripId, items([{ day: 1, spot: spots[0] }]),
    ]);
    const after = await as("service_role", null, "select spot_id from public.plan_items where day = 1 order by position");
    expect(after.slice(0, reversed.length)).toEqual(reversed);
    expect(after[after.length - 1].spot_id).toBe(spots[0]); // 新しい予定は、その日の最後
  });

  it("touch_plan：メンバーなら、全員向けに「工程案が変わりました」を出せる", async () => {
    const v = (await one("authenticated", B, "select public.touch_plan($1) as v", [tripId])).v as number;
    const pvA = (await one("authenticated", A, "select public.plan_view($1) as r", [tripId])).r as { plan: { version: number; updated_reason: string }; me: { last_seen_plan_version: number } };
    expect(pvA.plan.version).toBe(v);
    expect(pvA.plan.updated_reason).toBe("工程案が変わりました");
    expect(pvA.me.last_seen_plan_version).toBeLessThan(v); // A はまだ見ていない
    const D = "00000000-0000-0000-0000-00000000000d";
    expect(await fails(as("authenticated", D, "select public.touch_plan($1)", [tripId]))).toBe(true);
  });

  it("外した場所の記録（removed_spots）：メンバーだけ。足し直したら消せる", async () => {
    await as("authenticated", B, "insert into public.removed_spots (trip_id, spot_id, removed_by) values ($1, $2, $3)", [tripId, spots[0], B]);
    expect(await as("authenticated", A, "select * from public.removed_spots")).toHaveLength(1);
    const D = "00000000-0000-0000-0000-00000000000d";
    expect(await as("authenticated", D, "select * from public.removed_spots")).toHaveLength(0);
    expect(await fails(as("authenticated", D, "insert into public.removed_spots (trip_id, spot_id) values ($1, $2)", [tripId, spots[1]]))).toBe(true);
    await as("authenticated", A, "delete from public.removed_spots where trip_id = $1 and spot_id = $2", [tripId, spots[0]]);
    expect(await as("authenticated", A, "select * from public.removed_spots")).toHaveLength(0);
  });

  it("decide_trip：メンバーなら決められる。メンバーでなければ決められない", async () => {
    const D = "00000000-0000-0000-0000-00000000000d";
    expect(await fails(as("authenticated", D, "select public.decide_trip($1)", [tripId]))).toBe(true);
    await as("authenticated", B, "select public.decide_trip($1)", [tripId]);
    expect((await one("authenticated", A, "select status from public.trips where id = $1", [tripId])).status).toBe("decided");
  });
});

// 画面が使う upsert（INSERT ... ON CONFLICT）が、grant と policy で通ることを確かめる（Supabase の supabase-js の upsert と同じ形）
describe("画面が使う upsert", () => {
  it("answers / ratings / plan_items は ON CONFLICT DO UPDATE で更新できる。removed_spots / visits は DO NOTHING", async () => {
    await as("authenticated", B, `insert into public.answers (member_id, question_id, value) values ($1, 'style', '2')
      on conflict (member_id, question_id) do update set value = excluded.value`, [memberB]);
    await as("authenticated", B, `insert into public.answers (member_id, question_id, value) values ($1, 'style', '5')
      on conflict (member_id, question_id) do update set value = excluded.value`, [memberB]);
    expect((await one("authenticated", B, "select value from public.answers where question_id = 'style'")).value).toBe(5);

    await as("authenticated", B, `insert into public.ratings (member_id, candidate_id, level) values ($1, $2, 1)
      on conflict (member_id, candidate_id) do update set level = excluded.level`, [memberB, cands[0]]);
    expect((await one("authenticated", B, "select level from public.ratings where candidate_id = $1", [cands[0]])).level).toBe(1);

    const item = await one("authenticated", B, "select id, trip_id from public.plan_items limit 1");
    await as("authenticated", B, `insert into public.plan_items (id, trip_id, day, position, title, source) values ($1, $2, 1, 7, 'x', 'user')
      on conflict (id) do update set position = excluded.position, title = excluded.title`, [item.id, item.trip_id]);
    expect((await one("authenticated", B, "select position from public.plan_items where id = $1", [item.id])).position).toBe(7);

    const spot = "nagano-shibu-sotoyu";
    for (let i = 0; i < 2; i++) {
      await as("authenticated", B, `insert into public.removed_spots (trip_id, spot_id, removed_by) values ($1, $2, $3) on conflict (trip_id, spot_id) do nothing`, [tripId, spot, B]);
      await as("authenticated", B, `insert into public.visits (user_id, spot_id) values ($1, $2) on conflict (user_id, spot_id) do nothing`, [B, spot]);
    }
    expect(await as("authenticated", B, "select * from public.removed_spots")).toHaveLength(1);
    expect(await as("authenticated", B, "select * from public.visits")).toHaveLength(1);
  });
});

describe("言い出し役が人を足す（F2「＋ 人を追加」）", () => {
  it("owner は members に直接足せる（作られた順の seq が付く）。メンバーでない人は足せない", async () => {
    const r = await one("authenticated", A, `insert into public.members (trip_id, name) values ($1, 'ゆうこ') returning seq`, [tripId]);
    expect(Number(r.seq)).toBeGreaterThan(0);
    expect(await as("authenticated", A, "select name from public.members order by seq desc limit 1")).toEqual([{ name: "ゆうこ" }]);
  });
});

// ---- 問12の自由入力（spot_id が null の予定）----
describe("サイトにない場所（spot_id が null の予定）", () => {
  let trip = "";
  let mA = "";
  let mB = "";
  const U1 = "00000000-0000-0000-0000-0000000000a1";
  const U2 = "00000000-0000-0000-0000-0000000000a2";
  const free = (day: number, title: string) => ({ day, spot_id: null, title, time_hint: "13:00", source: "user" });
  const spot = (day: number, id: string) => ({ day, spot_id: id, title: id, time_hint: "10:00", source: "rule" });

  beforeAll(async () => {
    await db.exec(`insert into auth.users values ('${U1}'), ('${U2}')`);
    const r = (await one("authenticated", U1, `select public.create_trip('あや', 'friends', '{}', '1', null, '{}', null, '{みさき}') as r`)).r as { trip_id: string; member_id: string };
    trip = r.trip_id;
    mA = r.member_id;
    mB = (await as("service_role", null, "select id from public.members where trip_id = $1 and not is_owner", [trip]))[0].id as string;
    await as("service_role", null, "update public.members set user_id = $2 where id = $1", [mB, U2]);
  });

  it("save_plan は spot_id が null の予定を入れられる。source=user は edited_by_user になる", async () => {
    await one("service_role", null, `select public.save_plan($1, '旅', 'rule', 'r', $2::jsonb, null)`, [
      trip, JSON.stringify([spot(1, "yamagata-ginzan-yukimi-buro"), free(2, "熊野古道")]),
    ]);
    const rows = await as("service_role", null, "select spot_id, title, source, edited_by_user, day from public.plan_items where trip_id = $1 order by day", [trip]);
    expect(rows.find((x) => x.title === "熊野古道")).toMatchObject({ spot_id: null, source: "user", edited_by_user: true, day: 2 });
    expect(rows.find((x) => x.spot_id === "yamagata-ginzan-yukimi-buro")).toMatchObject({ edited_by_user: false });
  });
  it("作り直しても消えず、同じタイトルは増えない。手を入れていない予定は入れ替わる", async () => {
    await one("service_role", null, `select public.save_plan($1, '旅', 'rule', 'r', $2::jsonb, null)`, [
      trip, JSON.stringify([spot(1, "yamagata-zao-juhyo-snowshoe"), free(1, "熊野古道"), free(1, "しまなみ海道")]),
    ]);
    const rows = await as("service_role", null, "select spot_id, title from public.plan_items where trip_id = $1 order by day, position", [trip]);
    expect(rows.filter((x) => x.title === "熊野古道")).toHaveLength(1);
    expect(rows.find((x) => x.title === "熊野古道")).toBeDefined();
    expect(rows.find((x) => x.title === "しまなみ海道")).toBeDefined();
    expect(rows.find((x) => x.spot_id === "yamagata-ginzan-yukimi-buro")).toBeUndefined(); // 手を入れていない銀山は、新しい案になかったので消える
  });
  it("plan_view は、spot_id が null の予定でも壊れず、平均の丸と levels を付けない", async () => {
    await as("authenticated", U1, "update public.members set rated_at = now() where id = $1", [mA]);
    const pv = (await one("authenticated", U1, "select public.plan_view($1) as r", [trip])).r as { items: { title: string; spot_id: string | null; avg: number | null; levels: number[] }[] };
    const it = pv.items.find((i) => i.title === "熊野古道")!;
    expect(it).toMatchObject({ spot_id: null, avg: null, levels: [] });
  });
  it("メンバーは、spot_id が null の予定を並べ替え・日の移動・削除できる", async () => {
    const id = (await one("authenticated", U2, "select id from public.plan_items where title = '熊野古道'")).id as string;
    await as("authenticated", U2, `insert into public.plan_items (id, trip_id, day, position, spot_id, title, time_hint, edited_by_user, source)
      values ($1, $2, 2, 9, null, '熊野古道', '13:00', true, 'user') on conflict (id) do update set day = excluded.day, position = excluded.position`, [id, trip]);
    expect((await one("authenticated", U2, "select day, position from public.plan_items where id = $1", [id]))).toMatchObject({ day: 2, position: 9 });
    expect(await as("authenticated", U2, "delete from public.plan_items where id = $1 returning id", [id])).toHaveLength(1);
  });
  it("外した記録（removed_free_places）：メンバーだけ。30字まで", async () => {
    await as("authenticated", U2, "insert into public.removed_free_places (trip_id, place_text, removed_by) values ($1, '熊野古道', $2) on conflict do nothing", [trip, U2]);
    expect(await as("authenticated", U1, "select * from public.removed_free_places")).toHaveLength(1);
    expect(await as("authenticated", D, "select * from public.removed_free_places")).toHaveLength(0);
    expect(await fails(as("authenticated", D, "insert into public.removed_free_places (trip_id, place_text) values ($1, 'x')", [trip]))).toBe(true);
    expect(await fails(as("authenticated", U1, "insert into public.removed_free_places (trip_id, place_text) values ($1, $2)", [trip, "あ".repeat(31)]))).toBe(true);
    await as("authenticated", U1, "delete from public.removed_free_places where trip_id = $1 and place_text = '熊野古道'", [trip]);
    expect(await as("authenticated", U1, "select * from public.removed_free_places")).toHaveLength(0);
  });
  it("save_plan は、サーバー（service_role）だけが呼べるまま", async () => {
    expect(await fails(as("authenticated", U1, `select public.save_plan($1, 't', 'rule', 'r', '[]'::jsonb, null)`, [trip]))).toBe(true);
  });
});
const D = "00000000-0000-0000-0000-00000000000d";

describe("Realtime（段階6）", () => {
  it("plans・plan_items・members だけが publication に入り、ratings・answers・candidates は入らない", async () => {
    const rows = await as("service_role", null, "select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename");
    expect(rows.map((r) => r.tablename)).toEqual(["members", "plan_items", "plans"]);
  });
  it("削除の通知にも trip_id が入る（replica identity full）", async () => {
    const rows = await as("service_role", null, "select relname, relreplident from pg_class where relname in ('plans','plan_items','members') order by relname");
    expect(rows.map((r) => r.relreplident)).toEqual(["f", "f", "f"]);
  });
  it("もう一度流しても壊れない（すでに入っていれば何もしない）", async () => {
    const sql = readFileSync("supabase/migrations/20260104000000_realtime.sql", "utf8");
    await db.exec(sql);
    expect(await as("service_role", null, "select tablename from pg_publication_tables where pubname = 'supabase_realtime'")).toHaveLength(3);
  });
});
