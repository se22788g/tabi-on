// 行きたい度合い（0〜4）の集計と、工程案に使うおすすめの判定（仕様書 A2「AIを呼ぶ前のルール」）。AIは使わない。

/** 行きたい度合い（0〜4）の名前。画面に出す言葉 */
export const RATING_NAMES = ["行きたくない", "あまり", "どちらでもない", "行きたい", "すごく行きたい"] as const;
export type RatingLevel = 0 | 1 | 2 | 3 | 4;

export type CandidateStat = { candidateId: string; sum: number; min: number; count: number };
export type CandidateLite = { id: string; spotIds: string[] };

/** 平均（人数0なら null） */
export const statAvg = (s: CandidateStat | undefined): number | null => (s && s.count > 0 ? s.sum / s.count : null);

/**
 * 工程案に使えるおすすめを、平均が高い順に並べる。
 *  1. おすすめごとに、選んだ人の平均・最小・人数を出す（stats）。
 *  2. だれか1人でも「行きたくない（0）」を選んだおすすめは使わない。ただし、絶対行く（pinned）の場所を含むものは除かない。
 *  3. 平均が高い順。まだだれも選んでいないおすすめは、選ばれたものの後ろに、元の順番で並べる。
 * TODO(spec): 度合いがまだ1件もないとき（全員がとばしたとき）は、すべてのおすすめを元の順番で使う。
 */
export function rankCandidates<T extends CandidateLite>(cands: T[], stats: CandidateStat[], pinnedSpotIds: string[]): T[] {
  const byId = new Map(stats.map((s) => [s.candidateId, s]));
  const pinned = new Set(pinnedSpotIds);
  const usable = cands.filter((c) => {
    const s = byId.get(c.id);
    if (s && s.count > 0 && s.min === 0) return c.spotIds.some((id) => pinned.has(id));
    return true;
  });
  const index = new Map(cands.map((c, i) => [c.id, i]));
  return [...usable].sort((a, b) => {
    const aa = statAvg(byId.get(a.id));
    const bb = statAvg(byId.get(b.id));
    if (aa === null && bb === null) return index.get(a.id)! - index.get(b.id)!;
    if (aa === null) return 1;
    if (bb === null) return -1;
    return bb - aa || index.get(a.id)! - index.get(b.id)!;
  });
}

/**
 * 場所ごとの平均：その場所を含むおすすめへの評価の平均。同じ場所が複数のおすすめに入っているときは、
 * すべての評価を平均する（おすすめの平均の平均ではなく、評価そのものの平均）。
 */
export function spotAverages(cands: CandidateLite[], stats: CandidateStat[]): Map<string, number> {
  const byId = new Map(stats.map((s) => [s.candidateId, s]));
  const acc = new Map<string, { sum: number; count: number }>();
  for (const c of cands) {
    const s = byId.get(c.id);
    if (!s || s.count === 0) continue;
    for (const id of c.spotIds) {
      const a = acc.get(id) ?? { sum: 0, count: 0 };
      a.sum += s.sum;
      a.count += s.count;
      acc.set(id, a);
    }
  }
  return new Map([...acc].map(([id, a]) => [id, a.sum / a.count]));
}

/** 一人ずつの度合いを、平均の四捨五入にして高い順に並べる（名前なし） */
export const roundLevel = (avg: number): number => Math.min(4, Math.max(0, Math.round(avg)));
