// 金額と移動時間の目安（仕様書「金額と移動時間の目安」）。AIは使わない（ルール）。

export const ORIGIN_CITIES = ["東京", "大阪", "名古屋", "福岡", "仙台", "札幌"] as const;
export type OriginCity = (typeof ORIGIN_CITIES)[number];

// TODO(spec): 一番近い都市の対応は仮の決め方（地理的な近さの目安）。
const NEAREST: Record<OriginCity, string[]> = {
  札幌: ["北海道"],
  仙台: ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
  東京: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "山梨県", "長野県", "静岡県"],
  名古屋: ["富山県", "石川県", "福井県", "岐阜県", "愛知県", "三重県", "滋賀県"],
  大阪: ["京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "岡山県", "広島県", "島根県", "山口県", "徳島県", "香川県", "愛媛県", "高知県"],
  福岡: ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"],
};

export function nearestOrigin(prefecture: string): OriginCity {
  for (const city of ORIGIN_CITIES) {
    if (NEAREST[city].includes(prefecture)) return city;
  }
  return "東京";
}

/** 14エリア。場所の id の先頭2語（例：yamagata-ginzan-yukimi-buro → yamagata-ginzan） */
export const AREA_KEYS = [
  "hokkaido-otaru",
  "yamagata-ginzan",
  "yamagata-zao",
  "yamagata-yamadera",
  "kanagawa-hakone",
  "yamanashi-kawaguchiko",
  "nagano-shibu",
  "nagano-hakuba",
  "ishikawa-kanazawa",
  "gifu-shirakawago",
  "kyoto-arashiyama",
  "hyogo-kinosaki",
  "hiroshima-miyajima",
  "fukuoka-itoshima",
] as const;
export type AreaKey = (typeof AREA_KEYS)[number];

export function areaKeyOf(spotId: string): AreaKey | null {
  const key = spotId.split("-").slice(0, 2).join("-");
  return (AREA_KEYS as readonly string[]).includes(key) ? (key as AreaKey) : null;
}

/**
 * 出発地 × 14エリアの、公共交通での片道時間（分、30分単位）と往復の交通費（円）。
 * 並びは AREA_KEYS と同じ。
 * TODO(spec): 値はすべて、おおよその仮の値（仕様書は「おおよそでよい」）。実際の時刻表・運賃では確かめていない。
 */
const TRAVEL: Record<OriginCity, { minutes: number[]; fare: number[] }> = {
  東京: {
    minutes: [270, 240, 210, 180, 90, 120, 210, 210, 150, 270, 180, 270, 300, 270],
    fare: [60000, 30000, 27000, 25000, 6000, 5000, 18000, 22000, 29000, 36000, 31000, 38000, 41000, 45000],
  },
  大阪: {
    minutes: [330, 360, 330, 330, 180, 240, 300, 300, 120, 210, 30, 150, 120, 210],
    fare: [62000, 58000, 54000, 52000, 28000, 26000, 34000, 36000, 14000, 20000, 1000, 8000, 18000, 24000],
  },
  名古屋: {
    minutes: [360, 300, 270, 270, 120, 150, 210, 210, 150, 120, 120, 210, 210, 270],
    fare: [64000, 50000, 48000, 46000, 18000, 18000, 24000, 26000, 20000, 12000, 12000, 22000, 28000, 38000],
  },
  福岡: {
    minutes: [360, 360, 330, 330, 300, 330, 360, 360, 270, 330, 210, 270, 120, 30],
    fare: [66000, 62000, 60000, 58000, 42000, 44000, 52000, 54000, 38000, 44000, 26000, 34000, 14000, 1000],
  },
  仙台: {
    minutes: [300, 150, 120, 90, 210, 240, 240, 270, 300, 360, 330, 420, 420, 420],
    fare: [54000, 8000, 7000, 4000, 30000, 34000, 28000, 34000, 40000, 46000, 46000, 56000, 62000, 66000],
  },
  札幌: {
    minutes: [30, 330, 330, 300, 270, 300, 330, 330, 330, 390, 360, 420, 390, 420],
    fare: [2000, 60000, 58000, 56000, 56000, 58000, 62000, 64000, 64000, 70000, 66000, 72000, 74000, 76000],
  },
};

export function travelFor(origin: OriginCity, area: AreaKey): { minutes: number; roundTripFareYen: number } {
  const i = AREA_KEYS.indexOf(area);
  return { minutes: TRAVEL[origin].minutes[i], roundTripFareYen: TRAVEL[origin].fare[i] };
}

/** 「東京から約3時間30分」。出発地が未定（null）なら東京で計算し、「東京から」と書く */
export function travelTimeLabel(origin: OriginCity | null, spotId: string): string {
  const o = origin ?? "東京";
  const area = areaKeyOf(spotId);
  if (!area) return `${o}から`;
  const m = travelFor(o, area).minutes;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const t = h === 0 ? `${rest}分` : rest === 0 ? `${h}時間` : `${h}時間${rest}分`;
  return `${o}から約${t}`;
}

export type PriceSpot = { id: string; category: string; priceYen: number | null };
export type NightsKey = "day" | "1" | "2" | "3plus" | "undecided";

/** TODO(spec): 泊数の数え方。日帰り0・1泊1・2泊2・3泊以上3。未定は1泊として計算する（仮）。 */
export const nightsCount = (n: NightsKey): number => (n === "day" ? 0 : n === "1" ? 1 : n === "2" ? 2 : n === "3plus" ? 3 : 1);

/** TODO(spec): 「宿」の判定。category が stay、または1泊分の料金（12,000円以上）を持つ onsen を宿として数える（仮）。 */
export const isLodging = (s: PriceSpot): boolean => s.category === "stay" || (s.category === "onsen" && (s.priceYen ?? 0) >= 12000);

/**
 * おすすめの金額（ひとり）：往復の交通費＋含まれる場所の料金の合計。
 * 宿は泊数分。宿がなく泊まりの旅なら、1泊12,000円を泊数分足す。1,000円単位で丸める。
 * TODO(spec): 往復の交通費は、先頭の場所のエリアで引く（複数エリアにまたがる場合の決まりが仕様書にない）。
 * TODO(spec): 宿がない泊まりの旅は「1泊12,000円」を泊数分足す（仕様書は「1泊12,000円を足す」）。
 */
export function candidatePriceYen(args: { origin: OriginCity | null; spots: PriceSpot[]; nights: NightsKey }): number {
  const o = args.origin ?? "東京";
  const n = nightsCount(args.nights);
  const first = args.spots[0] ? areaKeyOf(args.spots[0].id) : null;
  let total = first ? travelFor(o, first).roundTripFareYen : 0;
  let hasLodging = false;
  for (const s of args.spots) {
    if (isLodging(s)) {
      hasLodging = true;
      total += (s.priceYen ?? 0) * n;
    } else {
      total += s.priceYen ?? 0;
    }
  }
  if (!hasLodging && n > 0) total += 12000 * n;
  return Math.round(total / 1000) * 1000;
}

export const formatPrice = (yen: number): string => `約${yen.toLocaleString("ja-JP")}円 / ひとり`;
