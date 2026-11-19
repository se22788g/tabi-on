// まだ行けていない場所（仕様書 M5）。自分の行きたい度合いからそのまま出すのでルール。AIは使わない。

export type WishRating = { candidateId: string; level: number; createdAt: string };
export type WishCandidate = { id: string; spotIds: string[] };

/** 「行きたい」（3）以上 */
export const WISH_MIN_LEVEL = 3;
export const WISH_PAGE = 10;

/**
 * 自分が行きたい度合い 3 以上を選んだおすすめの場所のうち、行った記録がないもの。新しい順（その場所を含む、3以上の度合いを付けた一番新しい時刻）。
 * 「行った」にすると消える。
 */
export function buildWishlist(args: { ratings: WishRating[]; candidates: WishCandidate[]; visitedSpotIds: Iterable<string> }): string[] {
  const visited = new Set(args.visitedSpotIds);
  const byId = new Map(args.candidates.map((c) => [c.id, c]));
  const latest = new Map<string, string>();
  for (const r of args.ratings) {
    if (r.level < WISH_MIN_LEVEL) continue;
    const c = byId.get(r.candidateId);
    if (!c) continue;
    for (const id of c.spotIds) {
      if (visited.has(id)) continue;
      const cur = latest.get(id);
      if (!cur || r.createdAt > cur) latest.set(id, r.createdAt);
    }
  }
  return [...latest].sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : a[0].localeCompare(b[0]))).map(([id]) => id);
}

/** 自分がその場所に付けた度合い：その場所を含むおすすめへの自分の度合いの平均（四捨五入）。なければ null（M4） */
export function myLevelFor(spotId: string, ratings: Pick<WishRating, "candidateId" | "level">[], candidates: WishCandidate[]): number | null {
  const ids = new Set(candidates.filter((c) => c.spotIds.includes(spotId)).map((c) => c.id));
  const levels = ratings.filter((r) => ids.has(r.candidateId)).map((r) => r.level);
  if (levels.length === 0) return null;
  return Math.min(4, Math.max(0, Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)));
}

/** 「東京から約3時間・1泊がおすすめ」の後ろ半分。TODO(spec): 目安の決め方は仕様書にない。片道3時間までは「日帰りから」、それより遠いと「1泊がおすすめ」。 */
export const stayAdvice = (minutes: number): string => (minutes <= 180 ? "日帰りから" : "1泊がおすすめ");
