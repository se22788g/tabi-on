// 金額と移動時間の目安（仕様書「金額と移動時間の目安」）。
// 段階1では、F1の「その他」の都道府県を6つの出発地に割り当てる表だけを置く。
// TODO(spec): 出発地×14エリアの所要時間・交通費の表は段階2で作る。

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
