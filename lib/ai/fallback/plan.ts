// 工程案を作る：ルール版（仕様書 A2「ルール版」）。AIが失敗したとき・まだAIをつないでいないときに使う。
// 平均が高い順に spot を並べ、同じエリアごとに日を分け、時刻は 10:00、13:00、16:00、18:30 を順に入れる。
// タイトルは「{一番多い都道府県}の旅」。
import { itemsPerDayRange, type KeptItem, type PlanOut } from "@/lib/domain/plan-rules";
import { rankCandidates, spotAverages, type CandidateLite, type CandidateStat } from "@/lib/domain/ratings";
import type { Spot } from "@/lib/domain/spot";
import { areaKeyOf } from "@/lib/domain/travel";

/** TODO(spec): 5つ目の時刻は仕様書にない。仮に 20:00。 */
export const TIME_HINTS = ["10:00", "13:00", "16:00", "18:30", "20:00"];

export type PlanRuleInput = {
  days: number;
  paceAvg: number | null;
  styleAvg: number | null;
  candidates: CandidateLite[];
  stats: CandidateStat[];
  spots: Map<string, Spot>;
  /** 絶対行く・手で直した予定（残す） */
  kept: KeptItem[];
  pinnedSpotIds: string[];
  removedSpotIds: string[];
};

export function rulePlan(input: PlanRuleInput): PlanOut {
  const { days, kept, spots } = input;
  const { max } = itemsPerDayRange(input.paceAvg, input.styleAvg);
  // TODO(spec): 1日の件数は、範囲の上のほうを使う（ルール版は、足りないより多めに出す）。
  const perDay = max;

  const ranked = rankCandidates(input.candidates, input.stats, input.pinnedSpotIds);
  const avg = spotAverages(input.candidates, input.stats);
  const skip = new Set([...kept.map((k) => k.spotId), ...input.removedSpotIds]);

  // 平均が高い順（平均がない場所は、中くらいの 2 として、おすすめの順番のまま後ろに）
  const order: { id: string; score: number; seq: number }[] = [];
  const seen = new Set<string>();
  ranked.forEach((c, ci) =>
    c.spotIds.forEach((id, si) => {
      if (seen.has(id) || skip.has(id) || !spots.has(id)) return;
      seen.add(id);
      order.push({ id, score: avg.get(id) ?? 2, seq: ci * 10 + si });
    }),
  );
  order.sort((a, b) => b.score - a.score || a.seq - b.seq);

  // 同じエリアをまとめる：エリアは、そのエリアで一番高い点数の順
  const areaBest = new Map<string, number>();
  for (const o of order) {
    const k = areaKeyOf(o.id) ?? o.id;
    if (!areaBest.has(k)) areaBest.set(k, areaBest.size);
  }
  const grouped = [...order].sort((a, b) => areaBest.get(areaKeyOf(a.id) ?? a.id)! - areaBest.get(areaKeyOf(b.id) ?? b.id)!);

  // 日ごとの空き：残す予定の数を引く
  const keptPerDay = new Map<number, number>();
  for (const k of kept) keptPerDay.set(k.day, (keptPerDay.get(k.day) ?? 0) + 1);
  const result: PlanOut["days"] = [];
  let cursor = 0;
  for (let d = 1; d <= days; d++) {
    const have = keptPerDay.get(d) ?? 0;
    const items = [];
    for (let i = 0; i < Math.max(0, perDay - have) && cursor < grouped.length; i++) {
      const s = spots.get(grouped[cursor++].id)!;
      items.push({ spot_id: s.id, title: s.name, time_hint: TIME_HINTS[Math.min(have + i, TIME_HINTS.length - 1)] });
    }
    result.push({ day: d, items });
  }

  // タイトル：一番多い都道府県（残す予定も数える）
  const prefs = new Map<string, number>();
  const used = [...kept.map((k) => k.spotId), ...result.flatMap((r) => r.items.map((i) => i.spot_id))];
  for (const id of used) {
    const p = spots.get(id)?.prefecture;
    if (p) prefs.set(p, (prefs.get(p) ?? 0) + 1);
  }
  const top = [...prefs].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { title: top ? `${top}の旅` : "旅の工程案", days: result };
}
