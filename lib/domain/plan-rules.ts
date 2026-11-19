// 工程案の制約（仕様書 A2）。AIの出力も、ルール版の出力も、ここの検査を通す。AIは使わない。
import type { Nights } from "./questions";

/** 日数：日帰り＝1日、1泊＝2日、2泊＝3日、3泊以上＝4日、未定＝2日 */
export const daysFor = (n: Nights): number => (n === "day" ? 1 : n === "1" ? 2 : n === "2" ? 3 : n === "3plus" ? 4 : 2);

/** 1日の予定の数：問2と問4の平均が 2.0 未満なら2〜3件、2.0〜3.5 なら3〜4件、3.5 以上なら4〜5件 */
export function itemsPerDayRange(paceAvg: number | null, styleAvg: number | null): { min: number; max: number } {
  const vals = [paceAvg, styleAvg].filter((v): v is number => v !== null);
  // TODO(spec): 回答がまだないときは、真ん中（3〜4件）にする。
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 2.75;
  if (avg < 2.0) return { min: 2, max: 3 };
  if (avg < 3.5) return { min: 3, max: 4 };
  return { min: 4, max: 5 };
}

export type PlanItemOut = { spot_id: string; title: string; time_hint: string };
export type PlanOut = { title: string; days: { day: number; items: PlanItemOut[] }[] };
export type KeptItem = { spotId: string; day: number };

/**
 * 工程案の出力の検査。存在しない場所・同じ場所の重複・外した場所・すでに残っている予定と同じ場所・件数の上限を超えた分を捨てる。
 * 残す予定（固定・手直し）は、DB の save_plan が消さずに元の日・位置のまま残すので、ここでは出力に重複して入れさせない。
 * 日の件数の上限は、残す予定を含めて数える。
 */
export function sanitizePlan(
  out: PlanOut,
  ctx: { knownSpotIds: ReadonlySet<string>; removedSpotIds: readonly string[]; kept: readonly KeptItem[]; maxPerDay: number },
): PlanOut {
  const seen = new Set<string>([...ctx.kept.map((k) => k.spotId), ...ctx.removedSpotIds]);
  const keptPerDay = new Map<number, number>();
  for (const k of ctx.kept) keptPerDay.set(k.day, (keptPerDay.get(k.day) ?? 0) + 1);
  const days = out.days.map((d) => {
    const room = Math.max(0, ctx.maxPerDay - (keptPerDay.get(d.day) ?? 0));
    const items: PlanItemOut[] = [];
    for (const it of d.items) {
      if (items.length >= room) break;
      if (!ctx.knownSpotIds.has(it.spot_id) || seen.has(it.spot_id)) continue;
      seen.add(it.spot_id);
      items.push(it);
    }
    return { day: d.day, items };
  });
  return { title: out.title, days };
}

export type FreeTextItem = { day: number; title: string; time_hint: string };

/** 時刻の目安の並び（ルール版の工程案と同じ）。TODO(spec): 5つ目以降は仮に 20:00。 */
const FREE_TIMES = ["10:00", "13:00", "16:00", "18:30", "20:00"];

/**
 * 自由入力された「サイトにない場所」を、工程案の中でいちばん予定の少ない日の最後に入れる（仕様書 M3）。
 * 予定の数が同じ日が並ぶときは、早い日。すでに工程案にある文字（外した記録も含む）は入れ直さない。
 * dayCounts：日ごとの、最終的な予定の数（残す予定と、新しく入れる予定の合計。1日目から）。
 */
export function placeFreeTexts(args: {
  texts: string[];
  dayCounts: number[];
  /** すでに工程案にある、spot_id なしの予定のタイトル */
  existingTitles: string[];
  /** 外した記録のある文字 */
  removedTexts: string[];
  normalize: (s: string) => string;
}): FreeTextItem[] {
  const counts = [...args.dayCounts];
  if (counts.length === 0) return [];
  const skip = new Set([...args.existingTitles, ...args.removedTexts].map(args.normalize));
  const out: FreeTextItem[] = [];
  for (const text of args.texts) {
    const key = args.normalize(text);
    if (!key || skip.has(key)) continue;
    skip.add(key);
    let day = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i] < counts[day]) day = i;
    out.push({ day: day + 1, title: text, time_hint: FREE_TIMES[Math.min(counts[day], FREE_TIMES.length - 1)] });
    counts[day]++;
  }
  return out;
}
