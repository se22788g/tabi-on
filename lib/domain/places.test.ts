import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCandidates } from "@/lib/ai/candidates";
import { aggregateAnswers } from "./answers";
import { matchFreeText, normalizePlaceText } from "./places";
import { placeFreeTexts } from "./plan-rules";
import { spotFromRow, type Spot } from "./spot";

const SPOTS: Spot[] = (JSON.parse(readFileSync("supabase/seed/spots.json", "utf8")) as Parameters<typeof spotFromRow>[0][]).map(spotFromRow);
const area = (id: string) => id.split("-").slice(0, 2).join("-");

describe("自由入力の場所：照らし方", () => {
  it("空白と記号を除き、全角・半角をそろえる", () => {
    expect(normalizePlaceText(" 熊野・古道！ ")).toBe("熊野古道");
    expect(normalizePlaceText("ＡＢＣ　ｄｅｆ")).toBe("abcdef");
  });
  it("name・area に（どちらの向きでも）部分一致すると、その spot とエリアが当たる", () => {
    const m = matchFreeText("銀山温泉に行きたい", SPOTS); // 入力のほうが長い
    expect(m.strong.length).toBeGreaterThan(0);
    expect(m.strong.every((s) => s.id.startsWith("yamagata-ginzan"))).toBe(true);
    const m2 = matchFreeText("蔵王", SPOTS); // area より短い・同じ
    expect(m2.strong.some((s) => s.id.startsWith("yamagata-zao"))).toBe(true);
    const m3 = matchFreeText("雪見露天の宿", SPOTS); // name の一部
    expect(m3.strong.map((s) => s.id)).toContain("yamagata-ginzan-yukimi-buro");
  });
  it("都道府県・tags の一致は、弱い一致（そのエリアの点数を上げる）", () => {
    const m = matchFreeText("山形", SPOTS);
    expect(m.strong).toHaveLength(0);
    expect(m.weak.length).toBeGreaterThan(0);
    expect(m.weak.every((s) => s.prefecture === "山形県")).toBe(true);
    expect(m.regions).toContain("tohoku");
    const t = matchFreeText("温泉めぐり", SPOTS);
    expect(t.weak.some((s) => s.tags.includes("温泉"))).toBe(true);
  });
  it("一致しないときは、都道府県名・主な地名で地域を当てる（例：熊野古道→関西）", () => {
    const m = matchFreeText("熊野古道", SPOTS);
    expect(m.strong).toHaveLength(0);
    expect(m.regions).toEqual(["kansai"]);
    expect(matchFreeText("屋久島", SPOTS).regions).toEqual(["kyushu"]);
    expect(matchFreeText("知床", SPOTS).regions).toEqual(["hokkaido"]);
  });
  it("どれにも当たらなくても壊れない（空の結果）", () => {
    expect(matchFreeText("あの秘密の場所", SPOTS)).toEqual({ strong: [], weak: [], regions: [] });
    expect(matchFreeText("！！！", SPOTS)).toEqual({ strong: [], weak: [], regions: [] });
  });
});

describe("回答の集計：自由入力", () => {
  it("spot の id と自由入力が混ざっていても、別々に集める。同じ文字は1つ", () => {
    const a = aggregateAnswers([
      { memberId: "m1", questionId: "places", value: ["yamagata-ginzan-yukimi-buro", { text: "熊野古道" }] },
      { memberId: "m2", questionId: "places", value: [{ text: "熊野・古道" }, { text: "  " }] },
    ]);
    expect(a.places).toEqual(["yamagata-ginzan-yukimi-buro"]);
    expect(a.freeTexts).toEqual(["熊野古道"]);
  });
});

describe("おすすめ：自由入力の場所（ルール版）", () => {
  const aggregate = aggregateAnswers([]);
  const base = { spots: SPOTS, aggregate, mine: {}, forced: [], existing: [], count: 3, allSpots: SPOTS };
  it("name・area に当たれば、そのエリアのおすすめが先頭に出て、reason に入力した文字が入る", async () => {
    const { candidates } = await createCandidates({ ...base, freeTexts: ["宮島の鳥居"] });
    expect(area(candidates[0].spot_ids[0])).toBe("hiroshima-miyajima");
    expect(candidates[0].reason).toBe("『宮島の鳥居』に近い場所として選びました");
    expect(candidates[0].reason.length).toBeLessThanOrEqual(40);
  });
  it("地名だけの自由入力（熊野古道）は、関西のエリアのおすすめが出る", async () => {
    const { candidates } = await createCandidates({ ...base, freeTexts: ["熊野古道"] });
    const kansai = candidates.filter((c) => ["kyoto-arashiyama", "hyogo-kinosaki"].includes(area(c.spot_ids[0])));
    expect(kansai.length).toBeGreaterThan(0);
    expect(candidates[0].reason).toContain("『熊野古道』に近い場所として選びました");
  });
  it("30字の入力でも、reason は40字以内", async () => {
    const long = "あ".repeat(10) + "銀山温泉" + "い".repeat(16);
    const { candidates } = await createCandidates({ ...base, freeTexts: [long] });
    expect(candidates.every((c) => c.reason.length <= 40)).toBe(true);
  });
  it("当たらない入力があっても、おすすめは普通に出る", async () => {
    const { candidates } = await createCandidates({ ...base, freeTexts: ["あの秘密の場所"] });
    expect(candidates).toHaveLength(3);
  });
});

describe("工程案：サイトにない場所を入れる日", () => {
  const norm = normalizePlaceText;
  it("いちばん予定の少ない日の最後に入る（同じ数なら早い日）", () => {
    const r = placeFreeTexts({ texts: ["熊野古道"], dayCounts: [4, 2, 3], existingTitles: [], removedTexts: [], normalize: norm });
    expect(r).toEqual([{ day: 2, title: "熊野古道", time_hint: "16:00" }]);
    expect(placeFreeTexts({ texts: ["a場所"], dayCounts: [3, 3], existingTitles: [], removedTexts: [], normalize: norm })[0].day).toBe(1);
  });
  it("複数あれば、入れるたびに数えて、日に散らす", () => {
    const r = placeFreeTexts({ texts: ["あ場所", "い場所", "う場所"], dayCounts: [2, 2], existingTitles: [], removedTexts: [], normalize: norm });
    expect(r.map((x) => x.day)).toEqual([1, 2, 1]);
  });
  it("すでにある・外した文字は、入れ直さない（作り直しで増えない・戻らない）", () => {
    const r = placeFreeTexts({ texts: ["熊野古道", "しまなみ海道", "屋久島"], dayCounts: [1, 1], existingTitles: ["熊野 古道"], removedTexts: ["しまなみ海道"], normalize: norm });
    expect(r.map((x) => x.title)).toEqual(["屋久島"]);
  });
  it("日がなければ何も入れない", () => {
    expect(placeFreeTexts({ texts: ["x場所"], dayCounts: [], existingTitles: [], removedTexts: [], normalize: norm })).toEqual([]);
  });
});
