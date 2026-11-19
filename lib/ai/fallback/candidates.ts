// おすすめを作る：ルール版（仕様書 A1「ルール版」）。AIが失敗したとき・まだAIをつないでいないときに使う。
// spot ごとに点数（問1・問5・問10で選ばれた category と tags の一致数＋問9の平均と vibe の近さ）を付け、
// エリアごとに上位2〜3件をまとめる。タイトルは「{エリア}で、{tag1}と{tag2}」。
import type { Aggregate } from "@/lib/domain/answers";
import type { CandidateOut } from "@/lib/domain/candidate-rules";
import { areaOf, matchFreeText } from "@/lib/domain/places";
import { areaLabelOf, type Spot } from "@/lib/domain/spot";
import { areaKeyOf } from "@/lib/domain/travel";

type Trait = { categories?: string[]; tags?: string[] };

/**
 * 選択肢（画面の言葉）と、spots の category・tags の対応。
 * TODO(spec): 対応表は仕様書にないため、選択肢の意味から決めた仮の表。
 */
const TRAITS: Record<string, Trait> = {
  // 問1 したいこと
  食べる: { categories: ["food"], tags: ["郷土料理", "海鮮"] },
  "自然・景色": { categories: ["nature"], tags: ["絶景"] },
  "温泉・いやし": { categories: ["onsen", "stay"], tags: ["温泉"] },
  "体験・アクティビティ": { categories: ["activity"], tags: ["体験"] },
  "街歩き・買い物": { categories: ["town"], tags: ["街歩き"] },
  "歴史・文化": { categories: ["culture"], tags: ["歴史"] },
  // 問5 季節（通年の選択肢を含む）
  雪景色を見る: { tags: ["雪景色"] },
  露天風呂: { tags: ["温泉"] },
  郷土料理: { tags: ["郷土料理"] },
  雪あそび: { tags: ["雪景色", "体験"] },
  カフェめぐり: { tags: ["カフェ"] },
  お花見: { tags: ["絶景"] },
  新緑の散歩: { categories: ["nature"], tags: ["絶景"] },
  いちご狩り: { tags: ["体験"] },
  春の味覚: { tags: ["郷土料理"] },
  "海・川あそび": { tags: ["体験", "絶景"] },
  "花火・夏祭り": { tags: ["夜景"] },
  高原で涼む: { tags: ["絶景"] },
  星空を見る: { tags: ["夜景"] },
  夏の味覚: { tags: ["郷土料理"] },
  紅葉を見る: { tags: ["絶景"] },
  味覚狩り: { tags: ["体験"] },
  秋の味覚: { tags: ["郷土料理"] },
  "美術館・アート": { tags: ["アート"] },
  景色を見る: { tags: ["絶景"] },
  温泉: { categories: ["onsen"], tags: ["温泉"] },
  アクティビティ: { categories: ["activity"], tags: ["体験"] },
  // 問10 食の好み
  ご当地グルメ: { tags: ["郷土料理"] },
  海鮮: { tags: ["海鮮"] },
  お肉: { categories: ["food"] },
  甘いもの: { tags: ["カフェ"] },
  子どもも食べやすい: { tags: ["家族"] },
};

const SCORED_QUESTIONS = ["wants", "season", "food"] as const;

type Picks = { option: string; count: number }[];

function picksOf(multi: Record<string, Record<string, number>>): Picks {
  const out: Picks = [];
  for (const q of SCORED_QUESTIONS) for (const [option, count] of Object.entries(multi[q] ?? {})) if (TRAITS[option]) out.push({ option, count });
  return out;
}

const matches = (spot: Spot, t: Trait) => (t.categories?.includes(spot.category) ? 1 : 0) + (t.tags?.filter((x) => spot.tags.includes(x)).length ?? 0);

function scoreSpot(spot: Spot, all: Picks, mine: Picks, vibeAvg: number | null): number {
  let s = 0;
  for (const p of all) s += p.count * matches(spot, TRAITS[p.option]);
  // いま答えた人の回答を重んじる（全員の集計に、もう一度足す）
  for (const p of mine) s += p.count * matches(spot, TRAITS[p.option]);
  if (vibeAvg !== null && spot.vibe !== null) s += 2 * (1 - Math.abs(vibeAvg - spot.vibe) / 4);
  return s;
}

export type CandidateRuleInput = {
  /** 絞り込みずみの spots */
  spots: Spot[];
  aggregate: Aggregate;
  /** いま答えた人の複数選択の回答（問いの id → 選択肢） */
  mine: Record<string, string[]>;
  /** 必ず1件に入れる場所（seed_spot_id と、「行きたい場所」で追加された場所）。先頭が一番優先 */
  forced: Spot[];
  /** 「行きたい場所」に自由入力された文字（サイトにない場所）。spots と部分一致で照らし、近いエリアを当てる */
  freeTexts?: string[];
  /** 自由入力の照合に使う、全部の spots（絞り込む前）。なければ spots */
  allSpots?: Spot[];
  /** すでにあるおすすめの spot_ids */
  existing: string[][];
  count: number;
};

const topTags = (spots: Spot[], n: number): string[] => {
  const freq = new Map<string, number>();
  for (const s of spots) for (const t of s.tags) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
};

export function ruleCandidates(input: CandidateRuleInput): CandidateOut[] {
  const { aggregate, count } = input;
  const all = picksOf(aggregate.multi);
  const mineMulti: Record<string, Record<string, number>> = {};
  for (const [q, opts] of Object.entries(input.mine)) mineMulti[q] = Object.fromEntries(opts.map((o) => [o, 1]));
  const mine = picksOf(mineMulti);
  const vibeAvg = aggregate.scale.vibe?.avg ?? null;

  // 自由入力の場所：name・area に一致した spot は「追加された spot」と同じ（必ず1件に入れる）。
  // 都道府県・tags に一致、または都道府県名・主な地名で当てた地域は、そのエリアの点数を上げる。
  const freeForced: Spot[] = [];
  const areaBonus = new Map<string, number>();
  const areaReason = new Map<string, string>();
  const lookup = input.allSpots ?? input.spots;
  for (const text of input.freeTexts ?? []) {
    const m = matchFreeText(text, lookup);
    for (const sp of m.strong) {
      if (!freeForced.some((f) => f.id === sp.id)) freeForced.push(sp);
      areaReason.set(areaOf(sp), areaReason.get(areaOf(sp)) ?? text);
    }
    for (const sp of m.weak) {
      areaBonus.set(areaOf(sp), (areaBonus.get(areaOf(sp)) ?? 0) + 1);
      areaReason.set(areaOf(sp), areaReason.get(areaOf(sp)) ?? text);
    }
    for (const sp of lookup) {
      if (m.regions.includes(sp.region)) {
        areaBonus.set(areaOf(sp), (areaBonus.get(areaOf(sp)) ?? 0) + 3);
        areaReason.set(areaOf(sp), areaReason.get(areaOf(sp)) ?? text);
      }
    }
  }
  const forcedAll = [...input.forced, ...freeForced.filter((f) => !input.forced.some((x) => x.id === f.id))];

  const score = new Map<string, number>();
  const pool = new Map<string, Spot>();
  for (const s of [...input.spots, ...forcedAll]) pool.set(s.id, s);
  for (const s of pool.values()) score.set(s.id, scoreSpot(s, all, mine, vibeAvg));

  // エリアごとにまとめる
  const byArea = new Map<string, Spot[]>();
  for (const s of pool.values()) {
    const k = areaKeyOf(s.id) ?? s.id;
    byArea.set(k, [...(byArea.get(k) ?? []), s]);
  }
  const forcedIds = new Set(forcedAll.map((s) => s.id));
  const sortSpots = (list: Spot[]) =>
    [...list].sort((a, b) => Number(forcedIds.has(b.id)) - Number(forcedIds.has(a.id)) || score.get(b.id)! - score.get(a.id)! || a.id.localeCompare(b.id));
  const areas = [...byArea].map(([key, list]) => {
    const top = sortSpots(list).slice(0, 3);
    return { key, top, total: top.reduce((n, s) => n + score.get(s.id)!, 0) + (areaBonus.get(key) ?? 0) };
  });

  // 必ず入れる場所のエリアを先に（seed → 追加された場所の順）、そのあと点数の高い順。すでにあるおすすめと同じエリアは後回し
  const usedAreas = new Set(input.existing.flat().map((id) => areaKeyOf(id) ?? id));
  const forcedKeys = [...new Set(forcedAll.map((s) => areaKeyOf(s.id) ?? s.id))];
  const rest = areas
    .filter((a) => !forcedKeys.includes(a.key))
    .sort((a, b) => Number(usedAreas.has(a.key)) - Number(usedAreas.has(b.key)) || b.total - a.total || a.key.localeCompare(b.key));
  const ordered = [...forcedKeys.map((k) => areas.find((a) => a.key === k)).filter((a): a is NonNullable<typeof a> => Boolean(a)), ...rest];

  const out: CandidateOut[] = [];
  for (const area of ordered.slice(0, count)) {
    const spots = area.top;
    if (spots.length < 2) continue;
    const tags = topTags(spots, 3);
    const label = areaLabelOf(spots[0]);
    const [t1, t2] = tags;
    const title = (t2 ? `${spots[0].area}で、${t1}と${t2}` : `${spots[0].area}で、${t1 ?? "ゆっくり"}`).slice(0, 20);
    // どの回答から選んだか：選んだ場所と一番よく合う選択肢（いま答えた人の回答を先に見る）
    const best = [...mine, ...all]
      .map((p) => ({ option: p.option, n: spots.reduce((n, s) => n + matches(s, TRAITS[p.option]), 0) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)[0];
    out.push({
      title,
      area_label: label.slice(0, 14),
      spot_ids: spots.map((s) => s.id),
      tags: tags.length >= 2 ? tags : [...tags, ...spots[0].tags.filter((t) => !tags.includes(t))].slice(0, 2),
      // 自由入力に近いエリアのおすすめには、「『{入力した文字}』に近い場所として選びました」（40字以内に収める）
      reason: (areaReason.has(area.key)
        ? `『${areaReason.get(area.key)!.slice(0, 26)}』に近い場所として選びました`
        : best ? `「${best.option}」を選んだ回答から` : "みんなの回答の傾向から"
      ).slice(0, 40),
    });
  }
  return out;
}
