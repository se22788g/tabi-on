import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ruleHeadline } from "@/lib/ai/fallback/tendency";
import { isPeakNow, ruleHome } from "@/lib/ai/fallback/home";
import { spotFromRow, type Spot } from "./spot";
import { AXIS_WORDS, computeTendency, toneOf, topTraitsOf, wordFor } from "./tendency";
import { buildWishlist, myLevelFor, stayAdvice } from "./wishlist";

const SPOTS: Spot[] = (JSON.parse(readFileSync("supabase/seed/spots.json", "utf8")) as Parameters<typeof spotFromRow>[0][]).map(spotFromRow);
const byId = new Map(SPOTS.map((s) => [s.id, s]));

describe("まだ行けていない場所", () => {
  const candidates = [
    { id: "c1", spotIds: ["a", "b"] },
    { id: "c2", spotIds: ["c", "b"] },
    { id: "c3", spotIds: ["d", "e"] },
  ];
  it("「行きたい」（3）以上を選んだおすすめの場所だけが出る", () => {
    const list = buildWishlist({
      ratings: [
        { candidateId: "c1", level: 4, createdAt: "2026-01-01" },
        { candidateId: "c2", level: 2, createdAt: "2026-01-02" },
        { candidateId: "c3", level: 3, createdAt: "2026-01-03" },
      ],
      candidates,
      visitedSpotIds: [],
    });
    expect(list.sort()).toEqual(["a", "b", "d", "e"]);
  });
  it("「行った」にすると消える", () => {
    const list = buildWishlist({ ratings: [{ candidateId: "c1", level: 4, createdAt: "2026-01-01" }], candidates, visitedSpotIds: ["a"] });
    expect(list).toEqual(["b"]);
  });
  it("新しい順。同じ場所が複数のおすすめにあるときは、3以上の一番新しい時刻", () => {
    const list = buildWishlist({
      ratings: [
        { candidateId: "c1", level: 4, createdAt: "2026-01-01" },
        { candidateId: "c3", level: 4, createdAt: "2026-01-05" },
        { candidateId: "c2", level: 3, createdAt: "2026-01-09" },
      ],
      candidates,
      visitedSpotIds: [],
    });
    expect(list.slice(0, 2).sort()).toEqual(["b", "c"]); // b は c2 の 01-09 が最新
    expect(list[list.length - 1]).toBe("a");
  });
  it("度合いが1件もなければ空", () => {
    expect(buildWishlist({ ratings: [], candidates, visitedSpotIds: [] })).toEqual([]);
  });
  it("M4：自分の度合いは、その場所を含むおすすめへの自分の度合いの平均（四捨五入）", () => {
    expect(myLevelFor("b", [{ candidateId: "c1", level: 4 }, { candidateId: "c2", level: 3 }], candidates)).toBe(4); // 3.5 → 4
    expect(myLevelFor("d", [{ candidateId: "c1", level: 4 }], candidates)).toBeNull();
  });
  it("日帰りか1泊かの目安", () => {
    expect(stayAdvice(180)).toBe("日帰りから");
    expect(stayAdvice(210)).toBe("1泊がおすすめ");
  });
});

describe("傾向の数値", () => {
  it("傾向の言葉は、平均の区間（1.0〜1.8／1.8〜2.6／2.6〜3.4／3.4〜4.2／4.2〜5.0）で決まる", () => {
    expect(wordFor("pace", 1)).toBe("とことんゆったり");
    expect(wordFor("pace", 1.8)).toBe("とことんゆったり");
    expect(wordFor("pace", 1.81)).toBe("ゆったりめ");
    expect(wordFor("pace", 3)).toBe("バランス派");
    expect(wordFor("pace", 4)).toBe("動きたい派");
    expect(wordFor("pace", 5)).toBe("とことんアクティブ");
    for (const axis of ["pace", "style", "travel_time", "vibe", "budget"]) expect(AXIS_WORDS[axis]).toHaveLength(5);
    expect(wordFor("budget", 4.5)).toBe("ときには贅沢を");
  });
  it("選んだ割合の色（80%以上／60〜79%／40〜59%／20〜39%／20%未満）", () => {
    expect([1, 0.8, 0.79, 0.6, 0.59, 0.4, 0.39, 0.2, 0.19, 0].map(toneOf)).toEqual(["strong", "strong", "often", "often", "normal", "normal", "light", "light", "rare", "rare"]);
  });
  const answers = [
    { questionId: "wants", value: ["温泉・いやし", "自然・景色"] },
    { questionId: "wants", value: ["温泉・いやし"] },
    { questionId: "wants", value: ["食べる", "温泉・いやし"] },
    { questionId: "pace", value: 2 }, { questionId: "pace", value: 3 }, { questionId: "pace", value: 4 },
    { questionId: "budget", value: 5 },
  ];
  it("「したいこと」は、選んだ回数が多い順。割合は、答えた回数に対する割合", () => {
    const t = computeTendency({ answers, ratingCount: 12, likedSpots: [] });
    expect(t.wants.map((w) => [w.label, w.count])).toEqual([["温泉・いやし", 3], ["食べる", 1], ["自然・景色", 1]]); // 同じ回数は、問1の選択肢の並び順
    expect(t.wants[0]).toMatchObject({ share: 1, tone: "strong" });
    expect(t.wants[1]).toMatchObject({ tone: "light" }); // 1/3
    expect(t.ratingCount).toBe(12);
  });
  it("5段階は、回答が3回分以上なら平均と言葉と位置。足りなければ「あと{n}回答えると」", () => {
    const t = computeTendency({ answers, ratingCount: 0, likedSpots: [] });
    const pace = t.axes.find((a) => a.id === "pace")!;
    expect(pace).toMatchObject({ n: 3, avg: 3, word: "バランス派", position: 0.5, remaining: 0 });
    const budget = t.axes.find((a) => a.id === "budget")!;
    expect(budget).toMatchObject({ n: 1, word: null, position: null, remaining: 2 });
    expect(t.axes.find((a) => a.id === "vibe")).toMatchObject({ n: 0, remaining: 3 });
  });
  it("行きたい度合い 3 以上の場所の category と tags の上位5つ。同じ意味の category と tag は一緒に数える", () => {
    const liked = ["yamagata-ginzan-yukimi-buro", "yamagata-ginzan-gaito-sanpo", "nagano-shibu-sotoyu"].map((id) => byId.get(id)!);
    const top = topTraitsOf(liked);
    expect(top.length).toBeLessThanOrEqual(5);
    expect(top[0]).toBe("温泉"); // 温泉 tag と onsen category を合わせて数える
    expect(new Set(top).size).toBe(top.length);
    expect(top.some((t) => ["友人", "家族", "ひとり旅"].includes(t))).toBe(false); // 同行者の tag は数えない
  });
  it("ひとこと（ルール版）：「{上位1}と{上位2}に、心が動くみたい。」", () => {
    expect(ruleHeadline(["温泉", "雪景色", "友人"])).toBe("温泉と雪景色に、心が動くみたい。");
    expect(ruleHeadline(["温泉"])).toBe("温泉に、心が動くみたい。");
    expect(ruleHeadline([])).toBeNull();
    expect(ruleHeadline(["アクティビティ・体験", "歴史・文化・街歩き"])!.length).toBeLessThanOrEqual(24);
  });
});

describe("マイページのおすすめ（ルール版）", () => {
  it("「いまが見頃」は、今の月を含み、楽しめる月が6か月以下のものだけ", () => {
    expect(isPeakNow({ seasonMonths: [12, 1, 2] }, 1)).toBe(true);
    expect(isPeakNow({ seasonMonths: [12, 1, 2] }, 6)).toBe(false);
    expect(isPeakNow({ seasonMonths: [1, 2, 3, 4, 5, 6, 7] }, 1)).toBe(false); // 7か月は見頃にしない
    expect(isPeakNow({ seasonMonths: [1, 2, 3, 4, 5, 6] }, 1)).toBe(true);
    expect(isPeakNow({ seasonMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, 1)).toBe(false); // ほぼ通年は使わない
  });
  it("度合いがない人には、3件の「いまが見頃」を出す（エリアは別々）", () => {
    const items = ruleHome({ month: 1, spots: SPOTS, excludeIds: [], topTraits: [] });
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.label === "いまが見頃")).toBe(true);
    expect(items.every((i) => isPeakNow(byId.get(i.spot_id)!, 1))).toBe(true);
    expect(new Set(items.map((i) => i.spot_id.split("-").slice(0, 2).join("-"))).size).toBe(3);
    expect(items[0].invite).toBe("気になる人を、気軽に誘ってみませんか。");
  });
  it("行った場所と、「まだ行けていない場所」にある場所は選ばない", () => {
    const base = ruleHome({ month: 1, spots: SPOTS, excludeIds: [], topTraits: [] });
    const items = ruleHome({ month: 1, spots: SPOTS, excludeIds: base.map((i) => i.spot_id), topTraits: [] });
    for (const i of items) expect(base.map((b) => b.spot_id)).not.toContain(i.spot_id);
    expect(items).toHaveLength(3);
  });
  it("傾向がある人は、傾向に合う場所が先に来る", () => {
    const hot = ruleHome({ month: 1, spots: SPOTS, excludeIds: [], topTraits: ["温泉", "雪景色"] });
    expect(hot.some((i) => byId.get(i.spot_id)!.tags.includes("温泉"))).toBe(true);
    const art = ruleHome({ month: 1, spots: SPOTS, excludeIds: [], topTraits: ["アート", "体験"] });
    expect(art.map((i) => i.spot_id)).not.toEqual(hot.map((i) => i.spot_id));
  });
  it("月が変わると、見頃の場所が変わる", () => {
    const winter = ruleHome({ month: 1, spots: SPOTS, excludeIds: [], topTraits: [] }).map((i) => i.spot_id);
    const summer = ruleHome({ month: 7, spots: SPOTS, excludeIds: [], topTraits: [] });
    expect(summer.map((i) => i.spot_id)).not.toEqual(winter);
    expect(summer).toHaveLength(3);
  });
});
