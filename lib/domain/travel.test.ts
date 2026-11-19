import { describe, expect, it } from "vitest";
import { nearestOrigin } from "./travel";
import { PREFECTURES } from "@/lib/mock/data";

describe("出発地の割り当て", () => {
  it("すべての都道府県がどれかの都市に割り当てられる", () => {
    for (const p of PREFECTURES) {
      expect(["東京", "大阪", "名古屋", "福岡", "仙台", "札幌"]).toContain(nearestOrigin(p));
    }
  });
  it("代表的な例", () => {
    expect(nearestOrigin("長野県")).toBe("東京");
    expect(nearestOrigin("広島県")).toBe("大阪");
    expect(nearestOrigin("北海道")).toBe("札幌");
  });
});
