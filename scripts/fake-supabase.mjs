// 画面の動作確認用の「偽の Supabase」。Playwright の route で、ブラウザから Supabase への通信を横取りして、
// メモリの中のデータで答える。本物の Supabase（あなたのプロジェクト）には、いっさい通信しない。
// 画面が、実際のレスポンスの形で壊れないか（列名・並び・配列かオブジェクトか）を確かめるためのもの。権限やSQLの確認ではない（それは PGlite のテスト）。
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export const jwt = (sub) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, role: "authenticated", aud: "authenticated", is_anonymous: true, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };

export function createFakeDb() {
  const spots = JSON.parse(readFileSync("supabase/seed/spots.json", "utf8"));
  return { spots, trips: [], members: [], answers: [], candidates: [], ratings: [], plan_items: [], plans: null, removed_spots: [], visits: [], profiles: [], log: [], seq: 0 };
}

const iso = () => new Date().toISOString();

function filter(rows, params) {
  return rows.filter((r) => {
    for (const [k, v] of params) {
      if (["select", "order", "limit", "on_conflict", "columns", "offset"].includes(k)) continue;
      if (v.startsWith("eq.")) { if (String(r[k]) !== v.slice(3)) return false; }
      else if (v.startsWith("in.(")) { if (!v.slice(4, -1).split(",").includes(String(r[k]))) return false; }
    }
    return true;
  });
}

export async function installFakeSupabase(context, db, { userId = randomUUID(), base = "http://127.0.0.1:54321" } = {}) {
  const user = { id: userId, aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: iso() };
  const session = () => ({ access_token: jwt(userId), refresh_token: "r", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user });
  const json = (route, body, status = 200) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
  const empty = (route, status = 204) => route.fulfill({ status, headers: CORS, body: "" });

  const planView = () => {
    const trip = db.trips[0];
    const me = db.members.find((m) => m.user_id === userId);
    const show = Boolean(me?.rated_at);
    const items = [...db.plan_items].sort((a, b) => a.day - b.day || a.position - b.position).map((i) => ({
      id: i.id, day: i.day, position: i.position, spot_id: i.spot_id, title: i.title, time_hint: i.time_hint, pinned: !!i.pinned,
      edited_by_user: !!i.edited_by_user, source: i.source, avg: show ? 3.5 : null, levels: show ? [4, 3] : [],
    }));
    const candSpots = [...new Set(db.candidates.flatMap((c) => c.spot_ids))].map((id) => ({ spot_id: id, avg: show ? 3 : null }));
    return {
      trip: { id: trip.id, code: trip.code, companion: trip.companion, status: trip.status, months: trip.months, nights: trip.nights, origin: trip.origin },
      plan: db.plans, me: me ? { member_id: me.id, answered_at: me.answered_at, rated_at: me.rated_at, last_seen_plan_version: me.last_seen_plan_version ?? 0 } : null,
      member_total: db.members.length, rated_count: db.members.filter((m) => m.rated_at).length, items, candidate_spots: candSpots,
    };
  };

  const rpc = (name, a) => {
    db.log.push(`rpc ${name}`);
    if (name === "create_trip") {
      const id = randomUUID();
      const code = "TABI-" + Array.from({ length: 4 }, () => "ABCDEFGH"[Math.floor(Math.random() * 8)]).join("");
      db.trips.push({ id, code, owner_id: userId, companion: a.p_companion, months: a.p_months, nights: a.p_nights, origin: a.p_origin, regions: a.p_regions, seed_spot_id: a.p_seed_spot_id, status: "collecting", created_at: iso() });
      const names = [a.p_owner_name || "わたし", ...a.p_names];
      const mid = randomUUID();
      names.forEach((n, i) => db.members.push({ id: i === 0 ? mid : randomUUID(), trip_id: id, name: n, user_id: i === 0 ? userId : null, is_owner: i === 0, answered_at: null, rated_at: null, last_seen_plan_version: 0, seq: ++db.seq, created_at: iso() }));
      return { trip_id: id, code, member_id: mid };
    }
    if (name === "get_invite") {
      const t = db.trips.find((x) => x.code === String(a.p_code).toUpperCase());
      if (!t) return null;
      const ms = db.members.filter((m) => m.trip_id === t.id);
      const me = ms.find((m) => m.user_id === userId);
      return { owner_name: ms.find((m) => m.is_owner)?.name, companion: t.companion, months: t.months, nights: t.nights, member_count: ms.length, members: ms.map((m) => ({ id: m.id, name: m.name, joined: !!m.user_id })), trip_id: me ? t.id : null, member_id: me?.id ?? null };
    }
    if (name === "join_trip") {
      const t = db.trips.find((x) => x.code === String(a.p_code).toUpperCase());
      let m = db.members.find((x) => x.trip_id === t.id && x.user_id === userId);
      if (m) return { trip_id: t.id, member_id: m.id, already: true };
      m = a.p_member_id ? db.members.find((x) => x.id === a.p_member_id) : (db.members.push({ id: randomUUID(), trip_id: t.id, name: a.p_new_name, user_id: null, is_owner: false, answered_at: null, rated_at: null, seq: ++db.seq, created_at: iso() }), db.members.at(-1));
      m.user_id = userId;
      return { trip_id: t.id, member_id: m.id, already: false };
    }
    if (name === "plan_view") return planView();
    if (name === "touch_plan") { if (db.plans) db.plans = { ...db.plans, version: db.plans.version + 1, updated_reason: "工程案が変わりました" }; const me = db.members.find((m) => m.user_id === userId); if (me) me.last_seen_plan_version = db.plans?.version ?? 0; return db.plans?.version ?? null; }
    if (name === "decide_trip") { db.trips[0].status = "decided"; return null; }
    return null;
  };

  const rest = (route, req) => {
    const url = new URL(req.url());
    const path = url.pathname.replace("/rest/v1/", "");
    const method = req.method();
    const wantsObject = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    const prefer = req.headers()["prefer"] ?? "";
    const reply = (rows) => (wantsObject ? (rows[0] ? json(route, rows[0]) : json(route, { message: "no rows" }, 406)) : json(route, rows));
    if (path.startsWith("rpc/")) return json(route, rpc(path.slice(4), body ?? {}));
    const tables = { spots: db.spots, trips: db.trips, members: db.members, answers: db.answers, candidates: db.candidates, ratings: db.ratings, plan_items: db.plan_items, removed_spots: db.removed_spots, visits: db.visits, profiles: db.profiles };
    if (!(path in tables)) return json(route, [], 200);
    const rows = tables[path];
    if (method === "GET" || method === "HEAD") {
      let out = filter(rows, url.searchParams);
      if (path === "trips" && (url.searchParams.get("select") ?? "").includes("members(")) {
        out = out.map((t) => ({ ...t, members: db.members.filter((m) => m.trip_id === t.id), plans: db.plans && db.trips[0]?.id === t.id ? { title: db.plans.title } : null }));
      }
      return reply(out);
    }
    if (method === "POST") {
      const list = Array.isArray(body) ? body : [body];
      db.log.push(`POST ${path} ${list.length}`);
      for (const r of list) {
        const key = { answers: ["member_id", "question_id"], ratings: ["member_id", "candidate_id"], profiles: ["id"], plan_items: ["id"], removed_spots: ["trip_id", "spot_id"], visits: ["user_id", "spot_id"] }[path];
        const i = key ? rows.findIndex((x) => key.every((k) => x[k] === r[k])) : -1;
        if (i >= 0) { if (!prefer.includes("ignore-duplicates")) rows[i] = { ...rows[i], ...r }; }
        else rows.push({ created_at: iso(), ...(path === "members" ? { id: randomUUID(), seq: ++db.seq, user_id: null, is_owner: false, answered_at: null, rated_at: null } : {}), ...r });
      }
      return prefer.includes("return=representation") ? json(route, list, 201) : empty(route, 201);
    }
    if (method === "PATCH") {
      const hit = filter(rows, url.searchParams);
      db.log.push(`PATCH ${path} ${hit.length}`);
      hit.forEach((r) => Object.assign(r, body));
      return prefer.includes("return=representation") ? json(route, hit) : empty(route);
    }
    if (method === "DELETE") {
      const hit = new Set(filter(rows, url.searchParams));
      db.log.push(`DELETE ${path} ${hit.size}`);
      for (let i = rows.length - 1; i >= 0; i--) if (hit.has(rows[i])) rows.splice(i, 1);
      return empty(route);
    }
    return empty(route);
  };

  await context.route(`${base}/**`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return empty(route);
    const p = new URL(req.url()).pathname;
    if (p.startsWith("/auth/v1/signup") || p.startsWith("/auth/v1/token")) return json(route, session());
    if (p.startsWith("/auth/v1/user")) return json(route, user);
    if (p.startsWith("/rest/v1/")) return rest(route, req);
    return json(route, {});
  });
  return { userId };
}
