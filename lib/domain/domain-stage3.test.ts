import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { aggregateAnswers } from "./answers";
import { candidateCountToAdd, filterSpots, sanitizeCandidates } from "./candidate-rules";
import { itemsPerDayRange, daysFor, sanitizePlan } from "./plan-rules";
import { rankCandidates, roundLevel, spotAverages, type CandidateStat } from "./ratings";
import { spotFromRow, type Spot } from "./spot";
import { regionsFromDb, regionsToDb } from "./regions";
import { ruleCandidates } from "@/lib/ai/fallback/candidates";
import { rulePlan } from "@/lib/ai/fallback/plan";
import { createCandidates } from "@/lib/ai/candidates";
import { createPlan } from "@/lib/ai/plan";

const SPOTS: Spot[] = (JSON.parse(readFileSync("supabase/seed/spots.json", "utf8")) as Parameters<typeof spotFromRow>[0][]).map(spotFromRow);
const byId = new Map(SPOTS.map((s) => [s.id, s]));
const stat = (candidateId: string, levels: number[]): CandidateStat => ({
  candidateId,
  sum: levels.reduce((a, b) => a + b, 0),
  min: Math.min(...levels),
  count: levels.length,
});

describe("回答の集計", () => {
  it("複数選択は選択肢ごとの人数、5段階は平均、場所は重複なし", () => {
    const a = aggregateAnswers([
      { memberId: "m1", questionId: "wants", value: ["食べる", "温泉・いやし"] },
      { memberId: "m2", questionId: "wants", value: ["温泉・いやし"] },
      { memberId: "m1", questionId: "pace", value: 2 },
      { memberId: "m2", questionId: "pace", value: 5 },
      { memberId: "m1", questionId: "places", value: ["a", "b"] },
      { memberId: "m2", questionId: "places", value: ["b"] },
    ]);
    expect(a.multi.wants).toEqual({ 食べる: 1, "温泉・いやし": 2 });
    expect(a.scale.pace).toEqual({ avg: 3.5, n: 2 });
    expect(a.scale.style).toEqual({ avg: null, n: 0 });
    expect(a.places.sort()).toEqual(["a", "b"]);
    expect(a.members).toBe(2);
  });
});

describe("行きたい度合いの集計と、工程案に使うおすすめ", () => {
  const cands = [
    { id: "c1", spotIds: ["s1", "s2"] },
    { id: "c2", spotIds: ["s3", "s2"] },
    { id: "c3", spotIds: ["s4", "s5"] },
  ];
  it("だれか1人でも 0 を選んだおすすめは使わない", () => {
    const r = rankCandidates(cands, [stat("c1", [4, 4]), stat("c2", [4, 0]), stat("c3", [3, 3])], []);
    expect(r.map((c) => c.id)).toEqual(["c1", "c3"]);
  });
  it("ただし、絶対行く（pinned）の場所を含むおすすめは、0 があっても使う", () => {
    const r = rankCandidates(cands, [stat("c1", [4, 4]), stat("c2", [4, 0]), stat("c3", [3, 3])], ["s3"]);
    expect(r.map((c) => c.id)).toEqual(["c1", "c3", "c2"]); // c2 は平均2で、c3（平均3）の後ろに残る
  });
  it("平均が高い順。まだ選ばれていないものは後ろに、元の順番で", () => {
    const r = rankCandidates(cands, [stat("c3", [4, 4]), stat("c1", [2, 2])], []);
    expect(r.map((c) => c.id)).toEqual(["c3", "c1", "c2"]);
  });
  it("場所ごとの平均は、含むおすすめへの評価をすべて平均する（平均の平均にしない）", () => {
    const avg = spotAverages(cands, [stat("c1", [4]), stat("c2", [0, 0, 0])]);
    expect(avg.get("s2")).toBe(1); // (4 + 0+0+0) / 4。平均の平均なら 2
    expect(avg.get("s1")).toBe(4);
    expect(avg.has("s4")).toBe(false);
  });
  it("一人ずつの丸は四捨五入", () => {
    expect(roundLevel(2.5)).toBe(3);
    expect(roundLevel(2.4)).toBe(2);
  });
});

describe("おすすめを作る前のルール", () => {
  it("件数：最初の人は5件、それ以降は3件、旅全体で12件まで", () => {
    expect(candidateCountToAdd(0)).toBe(5);
    expect(candidateCountToAdd(5)).toBe(3);
    expect(candidateCountToAdd(10)).toBe(2);
    expect(candidateCountToAdd(12)).toBe(0);
  });
  const base = { regions: [] as string[], months: [] as number[], nights: "1" as const, originCity: "東京" as const };
  it("地域が決まっていればその地域だけ", () => {
    const list = filterSpots(SPOTS, { ...base, regions: ["tohoku"] });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((s) => s.region === "tohoku")).toBe(true);
  });
  it("月が決まっていれば、その月を含むものだけ", () => {
    const list = filterSpots(SPOTS, { ...base, months: [1] });
    expect(list.every((s) => s.seasonMonths.includes(1))).toBe(true);
    expect(list.find((s) => s.id === "yamagata-zao-okama-view")).toBeUndefined(); // 5〜10月の場所
  });
  it("日帰りは、出発地から片道3時間を超える場所を除く", () => {
    const list = filterSpots(SPOTS, { ...base, nights: "day", originCity: "東京" });
    expect(list.find((s) => s.id.startsWith("hiroshima-"))).toBeUndefined();
    expect(list.find((s) => s.id.startsWith("kanagawa-hakone"))).toBeDefined();
  });
  it("条件が厳しすぎて3エリア残らないときは、ゆるめて空にしない", () => {
    const list = filterSpots(SPOTS, { ...base, regions: ["hokkaido"], months: [7], nights: "day", originCity: "大阪" });
    expect(new Set(list.map((s) => s.area)).size).toBeGreaterThanOrEqual(1);
    expect(list.length).toBeGreaterThan(0);
  });
  it("存在しない spot_id は捨て、2件未満になったおすすめも捨てる", () => {
    const out = sanitizeCandidates(
      [
        { title: "a", area_label: "x", spot_ids: ["yamagata-ginzan-yukimi-buro", "nowhere-fake", "yamagata-zao-juhyo-snowshoe"], tags: ["a", "b"], reason: "r" },
        { title: "b", area_label: "x", spot_ids: ["yamagata-ginzan-yukimi-buro", "nowhere-fake"], tags: ["a", "b"], reason: "r" },
      ],
      new Set(SPOTS.map((s) => s.id)),
    );
    expect(out).toHaveLength(1);
    expect(out[0].spot_ids).toEqual(["yamagata-ginzan-yukimi-buro", "yamagata-zao-juhyo-snowshoe"]);
  });
});

describe("おすすめ：ルール版", () => {
  const aggregate = aggregateAnswers([
    { memberId: "m1", questionId: "wants", value: ["温泉・いやし", "自然・景色"] },
    { memberId: "m1", questionId: "season", value: ["雪景色を見る", "露天風呂"] },
    { memberId: "m1", questionId: "vibe", value: 4 },
  ]);
  const mine = { wants: ["温泉・いやし", "自然・景色"], season: ["雪景色を見る", "露天風呂"] };
  const pool = filterSpots(SPOTS, { regions: [], months: [1], nights: "1", originCity: "東京" });

  it("エリアごとに2〜4件、タイトルは「{エリア}で、{tag1}と{tag2}」、「#」は付けない", async () => {
    const { source, candidates } = await createCandidates({ spots: pool, aggregate, mine, forced: [], existing: [], count: 5 });
    expect(source).toBe("rule");
    expect(candidates).toHaveLength(5);
    for (const c of candidates) {
      expect(c.spot_ids.length).toBeGreaterThanOrEqual(2);
      expect(c.spot_ids.length).toBeLessThanOrEqual(4);
      expect(new Set(c.spot_ids.map((id) => id.split("-").slice(0, 2).join("-"))).size).toBe(1); // 同じエリアだけ
      expect(c.title).toMatch(/^.+で、.+/);
      expect(c.title.length).toBeLessThanOrEqual(20);
      expect(c.tags.length).toBeGreaterThanOrEqual(2);
      expect(c.tags.every((t) => !t.includes("#"))).toBe(true);
      expect(c.reason.length).toBeLessThanOrEqual(40);
    }
    // 雪と温泉を選んだので、1番目は雪・温泉の場所が多いエリア
    expect(candidates[0].tags.some((t) => ["温泉", "雪景色"].includes(t))).toBe(true);
  });
  it("seed の場所と、追加された「行きたい場所」は、必ず1件に入る", async () => {
    const seed = byId.get("fukuoka-itoshima-umibe-villa")!;
    const place = byId.get("kyoto-arashiyama-chikurin")!;
    const { candidates } = await createCandidates({ spots: pool, aggregate, mine, forced: [seed, place], existing: [], count: 3 });
    expect(candidates.some((c) => c.spot_ids.includes(seed.id))).toBe(true);
    expect(candidates.some((c) => c.spot_ids.includes(place.id))).toBe(true);
    expect(candidates[0].spot_ids).toContain(seed.id); // seed が先頭
  });
  it("すでにあるおすすめと同じエリアは避ける", () => {
    const first = ruleCandidates({ spots: pool, aggregate, mine, forced: [], existing: [], count: 3 });
    const next = ruleCandidates({ spots: pool, aggregate, mine, forced: [], existing: first.map((c) => c.spot_ids), count: 3 });
    const area = (ids: string[]) => ids[0].split("-").slice(0, 2).join("-");
    const used = new Set(first.map((c) => area(c.spot_ids)));
    expect(next.every((c) => !used.has(area(c.spot_ids)))).toBe(true);
  });
});

describe("工程案：ルール版と検査", () => {
  const ginzan = SPOTS.filter((s) => s.id.startsWith("yamagata-ginzan"));
  const zao = SPOTS.filter((s) => s.id.startsWith("yamagata-zao"));
  const cands = [
    { id: "c1", spotIds: ginzan.slice(0, 3).map((s) => s.id) },
    { id: "c2", spotIds: zao.slice(0, 3).map((s) => s.id) },
  ];
  const input = {
    days: daysFor("1"),
    paceAvg: 3,
    styleAvg: 3,
    candidates: cands,
    stats: [stat("c1", [4, 3]), stat("c2", [3, 3])],
    spots: byId,
    kept: [],
    pinnedSpotIds: [],
    removedSpotIds: [],
  };
  it("日数と、1日の件数の決め方", () => {
    expect([daysFor("day"), daysFor("1"), daysFor("2"), daysFor("3plus"), daysFor("undecided")]).toEqual([1, 2, 3, 4, 2]);
    expect(itemsPerDayRange(1.9, 1.9)).toEqual({ min: 2, max: 3 });
    expect(itemsPerDayRange(2, 3.4)).toEqual({ min: 3, max: 4 });
    expect(itemsPerDayRange(4, 4)).toEqual({ min: 4, max: 5 });
  });
  it("平均が高い順・同じエリアをまとめて日に分け、時刻は 10:00, 13:00, 16:00 の順。タイトルは「{県}の旅」", () => {
    const out = rulePlan(input);
    expect(out.title).toBe("山形県の旅");
    expect(out.days).toHaveLength(2);
    expect(out.days[0].items.map((i) => i.time_hint)).toEqual(["10:00", "13:00", "16:00", "18:30"].slice(0, out.days[0].items.length));
    // 1日目は平均が高い銀山温泉のおすすめから
    expect(out.days[0].items[0].spot_id).toBe(cands[0].spotIds[0]);
    const day1Areas = new Set(out.days[0].items.map((i) => i.spot_id.split("-").slice(0, 2).join("-")));
    expect(day1Areas.has("yamagata-ginzan")).toBe(true);
  });
  it("だれか1人でも 0 のおすすめは使わない", () => {
    const out = rulePlan({ ...input, stats: [stat("c1", [4, 0]), stat("c2", [3, 3])] });
    const ids = out.days.flatMap((d) => d.items.map((i) => i.spot_id));
    expect(ids.some((id) => cands[0].spotIds.includes(id))).toBe(false);
    expect(ids.length).toBeGreaterThan(0);
  });
  it("残す予定は再び出さず、その日の空きだけ新しく入れる。外した場所は戻さない", () => {
    const keptSpot = cands[0].spotIds[0];
    const removed = cands[0].spotIds[1];
    const out = rulePlan({ ...input, kept: [{ spotId: keptSpot, day: 1 }], pinnedSpotIds: [keptSpot], removedSpotIds: [removed] });
    const ids = out.days.flatMap((d) => d.items.map((i) => i.spot_id));
    expect(ids).not.toContain(keptSpot);
    expect(ids).not.toContain(removed);
    const { max } = itemsPerDayRange(3, 3);
    expect(out.days[0].items.length).toBeLessThanOrEqual(max - 1); // 1日目は、残す予定の1件分が埋まっている
  });
  it("AIの出力に存在しない spot_id があっても、検査で捨てられる（画面に出ない）", () => {
    const out = sanitizePlan(
      { title: "t", days: [{ day: 1, items: [
        { spot_id: "fake-spot-id", title: "x", time_hint: "10:00" },
        { spot_id: cands[0].spotIds[0], title: "a", time_hint: "10:00" },
        { spot_id: cands[0].spotIds[0], title: "a2", time_hint: "13:00" }, // 重複
        { spot_id: cands[1].spotIds[0], title: "kept と同じ", time_hint: "16:00" },
      ] }] },
      { knownSpotIds: new Set(byId.keys()), removedSpotIds: [], kept: [{ spotId: cands[1].spotIds[0], day: 1 }], maxPerDay: 5 },
    );
    expect(out.days[0].items.map((i) => i.spot_id)).toEqual([cands[0].spotIds[0]]);
  });
  it("1日の件数の上限を超えた分は捨てる（残す予定も数える）", () => {
    const ids = SPOTS.slice(0, 8).map((s) => s.id);
    const out = sanitizePlan(
      { title: "t", days: [{ day: 1, items: ids.map((id) => ({ spot_id: id, title: id, time_hint: "10:00" })) }] },
      { knownSpotIds: new Set(byId.keys()), removedSpotIds: [], kept: [{ spotId: SPOTS[20].id, day: 1 }], maxPerDay: 5 },
    );
    expect(out.days[0].items).toHaveLength(4);
  });
  it("createPlan は source=rule で返す", async () => {
    const r = await createPlan(input);
    expect(r.source).toBe("rule");
    expect(r.plan.days.flatMap((d) => d.items).length).toBeGreaterThan(0);
  });
});

describe("地域の対応", () => {
  it("画面のチップ⇔DB", () => {
    expect(regionsToDb(["東北", "関東"])).toEqual(["tohoku", "kanto"]);
    expect(regionsToDb(["どこでも"])).toEqual(["anywhere"]);
    expect(regionsToDb([])).toEqual([]);
    expect(regionsFromDb(["tohoku"])).toEqual(["東北"]);
    expect(regionsFromDb(["anywhere"])).toEqual(["どこでも"]);
  });
});
