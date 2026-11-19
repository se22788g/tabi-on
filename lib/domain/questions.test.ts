import { describe, expect, it } from "vitest";
import { seasonOf, visibleQuestions, type TripConditions } from "./questions";

const base: TripConditions = { companion: "friends", months: [1, 2], nights: "1" };
const ids = (t: TripConditions) => visibleQuestions(t).map((q) => q.id);

describe("質問の出し分け", () => {
  it("12問すべてを出す（日帰りでなければ）", () => {
    expect(visibleQuestions(base)).toHaveLength(12);
  });

  it("日帰りでは宿の問い（stay）が出ない", () => {
    expect(ids({ ...base, nights: "day" })).not.toContain("stay");
    expect(visibleQuestions({ ...base, nights: "day" })).toHaveLength(11);
  });

  it("時期で問5の選択肢と問いが変わる", () => {
    const winter = visibleQuestions(base).find((q) => q.id === "season")!;
    expect(winter.title).toBe("冬なら何をしてみたい？");
    expect(winter.options).toContain("雪景色を見る");
    const summer = visibleQuestions({ ...base, months: [7] }).find((q) => q.id === "season")!;
    expect(summer.title).toBe("夏なら何をしてみたい？");
    expect(summer.options).toContain("星空を見る");
    const undecided = visibleQuestions({ ...base, months: [] }).find((q) => q.id === "season")!;
    expect(undecided.title).toBe("旅先で何をしてみたい？");
  });

  it("ひとりなら問3の「みんなで話す」が「ひとりの時間」になる", () => {
    const q = visibleQuestions({ ...base, companion: "solo" }).find((q) => q.id === "moments")!;
    expect(q.options).toContain("ひとりの時間");
    expect(q.options).not.toContain("みんなで話す");
  });

  it("小さい子ありなら問10の「お酒」が「子どもも食べやすい」になる", () => {
    const q = visibleQuestions({ ...base, companion: "family_kids" }).find((q) => q.id === "food")!;
    expect(q.options).toContain("子どもも食べやすい");
    expect(q.options).not.toContain("お酒");
  });

  it("時期が未定なら季節は未定扱い", () => {
    expect(seasonOf([])).toBe("undecided");
  });
});
