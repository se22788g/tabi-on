// おすすめを作る前のルール（仕様書 A1「spots の絞り込み」と出力の検査）。AIは使わない。
import { ANYWHERE } from "./regions";
import type { Nights } from "./questions";
import type { Spot } from "./spot";
import { areaKeyOf, travelFor, type OriginCity } from "./travel";

export const MAX_CANDIDATES_PER_TRIP = 12;
export const FIRST_COUNT = 5;
export const NEXT_COUNT = 3;

/** その旅で足すおすすめの件数：最初に答えた人は5件、それ以降は3件。旅全体で最大12件 */
export function candidateCountToAdd(existing: number): number {
  return Math.max(0, Math.min(existing === 0 ? FIRST_COUNT : NEXT_COUNT, MAX_CANDIDATES_PER_TRIP - existing));
}

export type TripFilter = { regions: string[]; months: number[]; nights: Nights; originCity: OriginCity | null };

const matchRegion = (s: Spot, f: TripFilter) => f.regions.length === 0 || f.regions.includes(ANYWHERE) || f.regions.includes(s.region);
const matchMonth = (s: Spot, f: TripFilter) => f.months.length === 0 || s.seasonMonths.some((m) => f.months.includes(m));
const matchDayTrip = (s: Spot, f: TripFilter) => {
  if (f.nights !== "day") return true;
  const area = areaKeyOf(s.id);
  if (!area) return true;
  return travelFor(f.originCity ?? "東京", area).minutes <= 180; // 日帰りは、出発地から片道3時間まで
};

/**
 * spots の絞り込み：地域が決まっていればその地域だけ。月が決まっていれば season_months にその月を含むものだけ。
 * 日帰りなら出発地から片道3時間を超えるものは除く。
 * TODO(spec): 絞り込みで3エリア分（おすすめを作れる数）が残らないときは、日帰りの条件→月→地域の順にゆるめる。
 */
export function filterSpots(all: Spot[], f: TripFilter, minAreas = 3): Spot[] {
  const steps: ((s: Spot) => boolean)[][] = [
    [(s) => matchRegion(s, f), (s) => matchMonth(s, f), (s) => matchDayTrip(s, f)],
    [(s) => matchRegion(s, f), (s) => matchMonth(s, f)],
    [(s) => matchRegion(s, f)],
    [],
  ];
  for (const preds of steps) {
    const list = all.filter((s) => preds.every((p) => p(s)));
    const areas = new Set(list.map((s) => areaKeyOf(s.id) ?? s.id));
    if (areas.size >= minAreas) return list;
  }
  return all;
}

export type CandidateOut = { title: string; area_label: string; spot_ids: string[]; tags: string[]; reason: string };

/**
 * おすすめの出力の検査（AIの出力にも、ルール版にも使う）：存在しない spot_id は捨てる。
 * 捨てた結果2件未満になったおすすめは捨てる。1件の spot_ids は4件まで。
 */
export function sanitizeCandidates(list: CandidateOut[], knownSpotIds: ReadonlySet<string>): CandidateOut[] {
  const out: CandidateOut[] = [];
  for (const c of list) {
    const ids = [...new Set(c.spot_ids)].filter((id) => knownSpotIds.has(id)).slice(0, 4);
    if (ids.length < 2) continue;
    out.push({ ...c, spot_ids: ids });
  }
  return out;
}
