// 画面の確認用の、偽の Supabase に入れる見本のデータ（旅 T：自分が言い出し役で回答・度合いを終えた旅、旅 T2：まだ参加していない旅）
import { randomUUID } from "node:crypto";
import { createFakeDb } from "./fake-supabase.mjs";

export function makeFixture() {
  const db = createFakeDb();
  const me = randomUUID();
  const T = randomUUID();
  const iso = () => new Date().toISOString();
  db.trips.push({ id: T, code: "TABI-ABCD", owner_id: me, companion: "friends", months: [1, 2], nights: "1", origin: "東京都", regions: [], seed_spot_id: null, status: "collecting", created_at: iso() });
  ["あや", "みさき"].forEach((n, i) => db.members.push({ id: randomUUID(), trip_id: T, name: n, user_id: i === 0 ? me : null, is_owner: i === 0, answered_at: iso(), rated_at: iso(), last_seen_plan_version: 0, seq: i + 1, created_at: iso() }));
  // 参加の画面（F3）用：自分がまだ参加していない旅
  const T2 = randomUUID();
  db.trips.push({ id: T2, code: "TABI-WXYZ", owner_id: randomUUID(), companion: "friends", months: [1], nights: "1", origin: null, regions: [], seed_spot_id: null, status: "collecting", created_at: iso() });
  ["けんた", "ゆうこ"].forEach((n, i) => db.members.push({ id: randomUUID(), trip_id: T2, name: n, user_id: i === 0 ? randomUUID() : null, is_owner: i === 0, answered_at: null, rated_at: null, seq: 10 + i, created_at: iso() }));
  const ids = (p) => db.spots.filter((s) => s.id.startsWith(p)).slice(0, 3).map((s) => s.id);
  for (const [t, a, p] of [["銀山温泉で、温泉と雪景色", "山形・銀山温泉", "yamagata-ginzan"], ["蔵王で、雪景色と体験", "山形・蔵王", "yamagata-zao"]]) db.candidates.push({ id: randomUUID(), trip_id: T, title: t, area_label: a, spot_ids: ids(p), tags: ["温泉", "雪景色"], source: "rule", for_member_id: null, created_at: iso() });
  db.plans = { version: 1, title: "山形県の旅", source: "rule", updated_reason: "1人目の回答で更新しました" };
  db.candidates.flatMap((c) => c.spot_ids).forEach((sid, i) => db.plan_items.push({ id: randomUUID(), trip_id: T, day: i < 3 ? 1 : 2, position: (i % 3) + 1, spot_id: sid, title: db.spots.find((x) => x.id === sid).name, time_hint: "10:00", pinned: false, edited_by_user: false, source: "rule" }));

  const base = process.argv[2] ?? "http://localhost:3000";

  return { db, me, T, T2 };
}
