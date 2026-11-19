// マイページのおすすめ：ルール版（仕様書 A4「ルール版」）。
// 今の月に楽しめ、傾向の上位 category に合うものを3件。invite は「気になる人を、気軽に誘ってみませんか。」。
// まだ行きたい度合いがない人には、ルールで選んだ「いまが見頃」の3件（AiBadge は付けない）。
import type { Spot } from "@/lib/domain/spot";
import { areaKeyOf } from "@/lib/domain/travel";

export type HomeLabel = "いまが見頃" | "あなたへのおすすめ" | "みんなの行きたいが重なった場所";
export type HomeItem = { spot_id: string; label: HomeLabel; title: string; invite: string };

export const HOME_INVITE = "気になる人を、気軽に誘ってみませんか。";

/** 「いまが見頃」：今の月を含み、楽しめる月が6か月以下のもの（仕様書の「決めたこと」） */
export const isPeakNow = (s: Pick<Spot, "seasonMonths">, month: number): boolean => s.seasonMonths.includes(month) && s.seasonMonths.length <= 6;

const traitsOf = (s: Spot) => new Set([...s.tags, s.category]);

export function ruleHome(args: {
  month: number;
  spots: Spot[];
  /** 行った場所と、「まだ行けていない場所」にすでにある場所（選ばない） */
  excludeIds: Iterable<string>;
  /** 傾向の上位の category と tags（なければ空。空ならまだ行きたい度合いがない人として、「いまが見頃」だけで選ぶ） */
  topTraits: string[];
}): HomeItem[] {
  const exclude = new Set(args.excludeIds);
  const pool = args.spots.filter((s) => !exclude.has(s.id));
  const traitScore = (s: Spot) => {
    const t = traitsOf(s);
    return args.topTraits.reduce((n, trait, i) => n + (t.has(trait) ? args.topTraits.length - i : 0), 0);
  };
  // 今の月に楽しめるものを先に。「いまが見頃」を優先し、そのあと傾向に合う順。同じ点なら id の順
  const rank = (s: Spot) => (isPeakNow(s, args.month) ? 2 : s.seasonMonths.includes(args.month) ? 1 : 0);
  // TODO(spec): 「傾向の上位 category に合う」の点数の付け方は仕様書にない。上位の特徴ほど重く数えた。
  const sorted = [...pool].sort((a, b) => rank(b) - rank(a) || traitScore(b) - traitScore(a) || a.id.localeCompare(b.id));
  const picked: Spot[] = [];
  const areas = new Set<string>();
  // 同じエリアが3件並ばないよう、まずエリアが違うものを選ぶ。足りなければ同じエリアからも選ぶ
  for (const s of sorted) {
    const a = areaKeyOf(s.id) ?? s.id;
    if (picked.length < 3 && !areas.has(a)) {
      picked.push(s);
      areas.add(a);
    }
  }
  for (const s of sorted) if (picked.length < 3 && !picked.includes(s)) picked.push(s);
  return picked.map((s) => ({
    spot_id: s.id,
    // TODO(spec): ルール版の理由のラベルは、見頃なら「いまが見頃」、それ以外は「あなたへのおすすめ」にした。
    label: isPeakNow(s, args.month) ? "いまが見頃" : "あなたへのおすすめ",
    // TODO(spec): ルール版のタイトルは、場所の名前をそのまま使う（AIのような短い言い換えはしない）。
    title: s.name,
    invite: HOME_INVITE,
  }));
}
