// F1 の「行き先の地域」「出発地」と、DB の値との対応。

export const REGION_LABELS: Record<string, string> = {
  hokkaido: "北海道",
  tohoku: "東北",
  kanto: "関東",
  chubu: "中部・北陸",
  kansai: "関西",
  chugoku_shikoku: "中国・四国",
  kyushu: "九州・沖縄",
};
export const ANYWHERE = "anywhere";

/** 画面のチップ（日本語）→ DB の値。「未定」は空（= 未定）、「どこでも」は 'anywhere' */
export function regionsToDb(labels: string[]): string[] {
  if (labels.includes("どこでも")) return [ANYWHERE];
  return Object.entries(REGION_LABELS)
    .filter(([, label]) => labels.includes(label))
    .map(([code]) => code);
}

/** DB の値 → 画面のチップ */
export function regionsFromDb(codes: string[]): string[] {
  if (codes.includes(ANYWHERE)) return ["どこでも"];
  return codes.map((c) => REGION_LABELS[c]).filter(Boolean);
}

/** 出発地のチップ → trips.origin（都道府県名）。「未定」は null。「その他」は選んだ都道府県 */
export const ORIGIN_PREFECTURE: Record<string, string> = {
  東京: "東京都",
  大阪: "大阪府",
  名古屋: "愛知県",
  福岡: "福岡県",
  仙台: "宮城県",
  札幌: "北海道",
};
