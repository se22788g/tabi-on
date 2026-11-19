import { describe, expect, it } from "vitest";
import { nearestOrigin, AREA_KEYS, ORIGIN_CITIES, areaKeyOf, candidatePriceYen, formatPrice, travelFor, travelTimeLabel } from "./travel";
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

describe("移動時間と金額の表", () => {
  it("6都市×14エリアが全部そろい、時間は30分単位", () => {
    for (const o of ORIGIN_CITIES) {
      for (const a of AREA_KEYS) {
        const t = travelFor(o, a);
        expect(t.minutes).toBeGreaterThan(0);
        expect(t.minutes % 30).toBe(0);
        expect(t.roundTripFareYen).toBeGreaterThan(0);
      }
    }
  });
  it("場所の id からエリアが分かる", () => {
    expect(areaKeyOf("yamagata-ginzan-yukimi-buro")).toBe("yamagata-ginzan");
    expect(areaKeyOf("unknown-spot")).toBeNull();
  });
  it("時間の書き方。未定なら東京", () => {
    expect(travelTimeLabel("東京", "yamagata-yamadera-ishidan")).toBe("東京から約3時間");
    expect(travelTimeLabel(null, "kanagawa-hakone-yuba-gozen")).toBe("東京から約1時間30分");
    expect(travelTimeLabel("大阪", "kyoto-arashiyama-chikurin")).toBe("大阪から約30分");
  });
  it("金額：交通費＋場所の料金。宿がない泊まりは1泊12,000円を足す。1,000円単位", () => {
    const spots = [
      { id: "yamagata-ginzan-soba-kawaoto", category: "food", priceYen: 1600 },
      { id: "yamagata-ginzan-gaito-sanpo", category: "culture", priceYen: 0 },
    ];
    // 30,000 + 1,600 = 31,600 → 32,000（日帰り）
    expect(candidatePriceYen({ origin: "東京", spots, nights: "day" })).toBe(32000);
    // 泊まりで宿なし：+12,000 → 43,600 → 44,000
    expect(candidatePriceYen({ origin: "東京", spots, nights: "1" })).toBe(44000);
    // 宿ありは泊数分：30,000 + 22,000×2 = 74,000
    const withInn = [{ id: "yamagata-ginzan-yukimi-buro", category: "onsen", priceYen: 22000 }];
    expect(candidatePriceYen({ origin: "東京", spots: withInn, nights: "2" })).toBe(74000);
    expect(formatPrice(28000)).toBe("約28,000円 / ひとり");
  });
});
