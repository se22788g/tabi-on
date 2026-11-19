// 段階3のSQLが、あなたの Supabase で動くかを、2人（匿名ログイン）で確かめる。キーは表示しない。
// 作ったテストの旅は、最後に消す。使い方: node --env-file=.env.local scripts/check-flow.mjs
// service_role キー（SUPABASE_SERVICE_ROLE_KEY）は、おすすめ・工程案を「サーバー」として入れる役に使う。
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.log("NG  .env.local に NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY を入れてください");
  process.exit(1);
}
let ng = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "OK " : "NG "} ${name}${!cond && extra ? `  ← ${extra}` : ""}`);
  if (!cond) ng++;
};
const mk = (key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const A = mk(anon), B = mk(anon), S = mk(service);
const SPOTS = ["yamagata-ginzan-yukimi-buro", "yamagata-zao-juhyo-snowshoe", "nagano-shibu-sotoyu"];

const a = await A.auth.signInAnonymously();
const b = await B.auth.signInAnonymously();
if (a.error || b.error) {
  console.log("NG  匿名ログインできません（Authentication → Sign In / Providers → Allow anonymous sign-ins）");
  process.exit(1);
}
const uidA = a.data.user.id, uidB = b.data.user.id;
let tripId = null;
try {
  // 旅をつくる（F1）
  const c = await A.rpc("create_trip", { p_owner_name: "あや", p_companion: "friends", p_months: [1, 2], p_nights: "1", p_origin: "東京都", p_regions: ["tohoku"], p_seed_spot_id: SPOTS[0], p_names: ["みさき"] });
  ok("旅をつくれる（create_trip）", !c.error && /^TABI-/.test(c.data?.code ?? ""), c.error?.message);
  if (c.error) throw c.error;
  tripId = c.data.trip_id;
  const code = c.data.code;

  // 招待と参加（F3）
  const inv = await B.rpc("get_invite", { p_code: code });
  ok("コードで招待の中身が見える（get_invite）", !inv.error && inv.data?.members?.length === 2, inv.error?.message);
  const anonClient = mk(anon);
  const invAnon = await anonClient.rpc("get_invite", { p_code: code });
  ok("ログイン前でも招待の中身が見える", !invAnon.error && invAnon.data?.owner_name === "あや", invAnon.error?.message);
  const misaki = inv.data.members.find((m) => m.name === "みさき");
  const j = await B.rpc("join_trip", { p_code: code, p_member_id: misaki.id, p_new_name: null });
  ok("名前を選んで参加できる（join_trip）", !j.error && j.data?.trip_id === tripId, j.error?.message);
  const memberB = j.data?.member_id;
  const ms = await B.from("members").select("id").eq("trip_id", tripId);
  ok("参加者はメンバー一覧を読める", !ms.error && ms.data.length === 2, ms.error?.message);
  const memberA = (await A.from("members").select("id").eq("user_id", uidA).eq("trip_id", tripId)).data?.[0]?.id;

  // 回答（F4）
  const ans = await B.from("answers").upsert({ member_id: memberB, question_id: "wants", value: ["食べる"] }, { onConflict: "member_id,question_id" });
  ok("自分の回答を保存できる", !ans.error, ans.error?.message);
  const peek = await A.from("answers").select("*").eq("member_id", memberB);
  ok("ほかの人の回答は読めない", !peek.error && peek.data.length === 0, peek.error?.message);
  const done = await B.from("members").update({ answered_at: new Date().toISOString() }).eq("id", memberB).select("id");
  ok("質問を終えた時刻を入れられる", !done.error && done.data.length === 1, done.error?.message);

  // おすすめ（サーバーだけが書く）
  const cands = await S.from("candidates").insert([
    { trip_id: tripId, title: "A", area_label: "山形・銀山温泉", spot_ids: [SPOTS[0], SPOTS[1]], tags: ["温泉", "雪景色"], source: "rule", for_member_id: memberA },
    { trip_id: tripId, title: "B", area_label: "長野・渋温泉", spot_ids: [SPOTS[2], SPOTS[1]], tags: ["温泉", "街歩き"], source: "rule", for_member_id: memberB },
  ]).select("id");
  ok("サーバー（service_role）がおすすめを書ける", !cands.error && cands.data.length === 2, cands.error?.message);
  const browserWrite = await A.from("candidates").insert({ trip_id: tripId, title: "x", area_label: "x", spot_ids: [SPOTS[0], SPOTS[1]], tags: ["a", "b"], source: "rule" });
  ok("ブラウザからはおすすめを書けない", Boolean(browserWrite.error));

  // 行きたい度合い（F6）
  const [c1, c2] = cands.data.map((x) => x.id);
  const rA = await A.from("ratings").upsert({ member_id: memberA, candidate_id: c1, level: 4 }, { onConflict: "member_id,candidate_id" });
  const rB = await B.from("ratings").upsert({ member_id: memberB, candidate_id: c1, level: 3 }, { onConflict: "member_id,candidate_id" });
  ok("行きたい度合いを保存できる", !rA.error && !rB.error, (rA.error ?? rB.error)?.message);
  const peekR = await A.from("ratings").select("*").eq("member_id", memberB);
  ok("ほかの人の度合いは直接読めない", !peekR.error && peekR.data.length === 0, peekR.error?.message);
  const stats = await S.rpc("candidate_stats", { p_trip_id: tripId });
  ok("サーバーは、おすすめごとの集計を出せる", !stats.error && stats.data?.length === 1, stats.error?.message);
  const statsBrowser = await A.rpc("candidate_stats", { p_trip_id: tripId });
  ok("ブラウザからは集計の関数を呼べない", Boolean(statsBrowser.error));

  // 工程案（A2 のあと）
  const items = SPOTS.map((id, i) => ({ day: i < 2 ? 1 : 2, spot_id: id, title: `予定${i}`, time_hint: "10:00", source: "rule" }));
  const sp = await S.rpc("save_plan", { p_trip_id: tripId, p_title: "山形県の旅", p_source: "rule", p_reason: "1人目の回答で更新しました", p_items: items, p_actor_member_id: memberA });
  ok("工程案を保存できる（save_plan）", !sp.error && sp.data === 1, sp.error?.message);
  const spBrowser = await A.rpc("save_plan", { p_trip_id: tripId, p_title: "x", p_source: "rule", p_reason: "x", p_items: [], p_actor_member_id: null });
  ok("ブラウザからは工程案の保存関数を呼べない", Boolean(spBrowser.error));
  const before = await B.rpc("plan_view", { p_trip_id: tripId });
  ok("自分が選ぶ前は、ほかの人の度合いが返らない", !before.error && before.data.items.every((i) => i.levels.length === 0 && i.avg === null), before.error?.message);
  await A.from("members").update({ rated_at: new Date().toISOString() }).eq("id", memberA);
  const after = await A.rpc("plan_view", { p_trip_id: tripId });
  const ginzan = after.data?.items?.find((i) => i.spot_id === SPOTS[0]);
  ok("選んだあとは、名前なしの配列（高い順）が返る", JSON.stringify(ginzan?.levels) === "[4,3]" && !JSON.stringify(after.data).includes(memberB), JSON.stringify(ginzan?.levels));

  // 工程案を直す（M3）
  const pi = (await B.from("plan_items").select("id, position").eq("trip_id", tripId).eq("day", 1).order("position")).data ?? [];
  const re = await B.from("plan_items").update({ position: 9, edited_by_user: true }).eq("id", pi[0]?.id).select("id");
  ok("メンバーは予定を並べ替えられる", !re.error && re.data?.length === 1, re.error?.message);
  const rm = await B.from("removed_spots").upsert({ trip_id: tripId, spot_id: SPOTS[2], removed_by: uidB }, { onConflict: "trip_id,spot_id", ignoreDuplicates: true });
  ok("外した場所を記録できる", !rm.error, rm.error?.message);
  const tp = await B.rpc("touch_plan", { p_trip_id: tripId });
  ok("「工程案が変わりました」を出せる（touch_plan）", !tp.error && tp.data === 2, tp.error?.message);
  const ok2 = await B.rpc("decide_trip", { p_trip_id: tripId });
  ok("この案で決められる（decide_trip）", !ok2.error, ok2.error?.message);
} catch (e) {
  console.log("NG  途中で止まりました:", e?.message ?? e);
  ng++;
} finally {
  // 後片づけ：テストの旅を消す（言い出し役の権限で。メンバーなども一緒に消える）
  if (tripId) {
    const del = await A.from("trips").delete().eq("id", tripId);
    console.log(del.error ? `（テストの旅を消せませんでした: ${tripId}）` : "（テストの旅を消しました）");
  }
}
console.log(ng ? `${ng} 件 NG` : "すべて OK");
process.exit(ng ? 1 : 0);
