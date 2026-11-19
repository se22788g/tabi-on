import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { spotSchema, type SpotRow } from "./spot-schema";
import { AREA_KEYS, areaKeyOf } from "@/lib/domain/travel";

const spots: SpotRow[] = (JSON.parse(readFileSync("supabase/seed/spots.json", "utf8")) as unknown[]).map((s) => spotSchema.parse(s));

/** 各エリアの中心（仕様書：lat/lng はそのエリアの中心から2km以内） */
const CENTER: Record<string, [number, number]> = {
  "hokkaido-otaru": [43.1907, 140.9947],
  "yamagata-ginzan": [38.5713, 140.5301],
  "yamagata-zao": [38.1697, 140.4184],
  "yamagata-yamadera": [38.3128, 140.4372],
  "kanagawa-hakone": [35.2326, 139.107],
  "yamanashi-kawaguchiko": [35.5127, 138.7637],
  "nagano-shibu": [36.7448, 138.4276],
  "nagano-hakuba": [36.698, 137.862],
  "ishikawa-kanazawa": [36.5613, 136.6562],
  "gifu-shirakawago": [36.257, 136.906],
  "kyoto-arashiyama": [35.0094, 135.6668],
  "hyogo-kinosaki": [35.6247, 134.811],
  "hiroshima-miyajima": [34.2961, 132.3198],
  "fukuoka-itoshima": [33.557, 130.195],
};
const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r;
  const dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

describe("spots の seed（架空の旅行先カタログ）", () => {
  it("56件で、id が重ならない", () => {
    expect(spots).toHaveLength(56);
    expect(new Set(spots.map((s) => s.id)).size).toBe(56);
  });
  it("14エリア × 4件。travel.ts のエリアと一致する", () => {
    const byArea = new Map<string, SpotRow[]>();
    for (const s of spots) {
      const k = areaKeyOf(s.id);
      expect(k, s.id).not.toBeNull();
      byArea.set(k!, [...(byArea.get(k!) ?? []), s]);
    }
    expect([...byArea.keys()].sort()).toEqual([...AREA_KEYS].sort());
    for (const [k, list] of byArea) expect(list, k).toHaveLength(4);
  });
  it("各エリアの内訳：食べる1・自然か文化1・温泉か宿1・体験1、予約できる体験が1件", () => {
    const byArea = new Map<string, SpotRow[]>();
    for (const s of spots) byArea.set(areaKeyOf(s.id)!, [...(byArea.get(areaKeyOf(s.id)!) ?? []), s]);
    for (const [k, list] of byArea) {
      const c = (names: string[]) => list.filter((s) => names.includes(s.category)).length;
      expect(c(["food"]), k).toBe(1);
      expect(c(["nature", "culture"]), k).toBe(1);
      expect(c(["onsen", "stay"]), k).toBe(1);
      expect(c(["activity"]), k).toBe(1);
      expect(list.filter((s) => s.is_partner), k).toHaveLength(1);
    }
  });
  it("書き方の決まり：説明は2〜3文、住所の末尾は（架空）、架空フラグ", () => {
    for (const s of spots) {
      const sentences = s.description.split("。").filter(Boolean).length;
      expect(sentences, s.id).toBeGreaterThanOrEqual(2);
      expect(sentences, s.id).toBeLessThanOrEqual(3);
      expect(s.address, s.id).toMatch(/（架空）$/);
      expect(s.is_fictional).toBe(true);
    }
  });
  it("緯度経度は、エリアの中心から2km以内", () => {
    for (const s of spots) expect(km(CENTER[areaKeyOf(s.id)!], [s.lat!, s.lng!]), s.id).toBeLessThanOrEqual(2);
  });
  it("料金の目安が、種類ごとの範囲に入る", () => {
    for (const s of spots) {
      const p = s.price_yen!;
      const [lo, hi] =
        s.category === "food" ? [1200, 4000]
        : s.category === "activity" ? [3000, 9000]
        : s.category === "stay" ? [12000, 30000]
        : s.category === "nature" || s.category === "culture" ? [0, 1000]
        : [0, 30000];
      expect(p, s.id).toBeGreaterThanOrEqual(lo);
      expect(p, s.id).toBeLessThanOrEqual(hi);
      // 温泉は、日帰りの入浴（4,000円まで）か、1泊の宿（12,000〜30,000円）
      if (s.category === "onsen") expect(p <= 4000 || p >= 12000, s.id).toBe(true);
    }
  });
  it("段階1の仮データと同じ場所（id・名前）が入っている", () => {
    for (const id of ["yamagata-ginzan-yukimi-buro", "yamagata-zao-juhyo-snowshoe", "yamagata-yamadera-ishidan", "nagano-shibu-sotoyu", "yamanashi-kawaguchiko-fuji-cafe", "hiroshima-miyajima-torii-kayak"]) {
      expect(spots.find((s) => s.id === id), id).toBeDefined();
    }
  });
});
