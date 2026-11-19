// あなたの旅の傾向の数値（仕様書 M6・A3 の入力）。根拠を説明できるべきなのでルール。AIは使わない。
import { QUESTIONS } from "./questions";
import type { Spot } from "./spot";

export type AnswerRowLite = { questionId: string; value: unknown };

/** 5段階の問い（旅のペース・過ごし方・移動・行き先・予算）と、画面での名前 */
export const AXES = [
  { id: "pace", title: "旅のペース" },
  { id: "style", title: "過ごし方" },
  { id: "travel_time", title: "移動" },
  { id: "vibe", title: "行き先" },
  { id: "budget", title: "予算" },
] as const;

/** 傾向の言葉（平均 1.0〜1.8／1.8〜2.6／2.6〜3.4／3.4〜4.2／4.2〜5.0） */
export const AXIS_WORDS: Record<string, [string, string, string, string, string]> = {
  pace: ["とことんゆったり", "ゆったりめ", "バランス派", "動きたい派", "とことんアクティブ"],
  style: ["予定は少なく", "余白もほしい", "ほどほど", "少し充実させたい", "ぎっしり楽しむ"],
  travel_time: ["近場がいい", "短めがいい", "どちらでも", "遠出も楽しめる", "どこまでも行ける"],
  vibe: ["定番が好き", "定番寄り", "どちらも", "穴場寄り", "まだ知らない場所へ"],
  budget: ["おさえたい", "少しおさえたい", "ほどほど", "少し贅沢を", "ときには贅沢を"],
};

/** 傾向の言葉。境目は、下の区間に入れる（1.8 ちょうどは「ゆったりめ」） */
export function wordFor(axis: string, avg: number): string {
  const words = AXIS_WORDS[axis];
  const i = avg <= 1.8 ? 0 : avg <= 2.6 ? 1 : avg <= 3.4 ? 2 : avg <= 4.2 ? 3 : 4;
  return words[i];
}

/** 回答が、この回数に満たない問いは、バーの代わりに「あと{n}回答えると見えてきます」を出す */
export const MIN_ANSWERS = 3;

export type Tone = "strong" | "often" | "normal" | "light" | "rare";
/** 選んだ割合 80%以上／60〜79%／40〜59%／20〜39%／20%未満 */
export const toneOf = (share: number): Tone => (share >= 0.8 ? "strong" : share >= 0.6 ? "often" : share >= 0.4 ? "normal" : share >= 0.2 ? "light" : "rare");

export type AxisView = {
  id: string;
  title: string;
  left: string;
  right: string;
  n: number;
  avg: number | null;
  /** 平均の位置（0〜1。左端＝0） */
  position: number | null;
  word: string | null;
  /** あと何回答えると見えてくるか（足りているなら 0） */
  remaining: number;
};

export type Tendency = {
  /** これまでの行きたい度合いの件数 */
  ratingCount: number;
  wants: { label: string; count: number; share: number; tone: Tone }[];
  axes: AxisView[];
  /** 行きたい度合い 3 以上を選んだ場所の category と tags の上位5つ */
  topTraits: string[];
};

/** category を、tags と同じ言葉にそろえて数える（温泉と onsen を別々に数えない） */
const CATEGORY_TRAIT: Record<string, string> = {
  food: "食べること", nature: "絶景", onsen: "温泉", activity: "体験", town: "街歩き", culture: "歴史", stay: "宿",
};

/**
 * TODO(spec): 「category と tags の上位5つ」の数え方は仕様書にない。category は、近い tag と同じ言葉
 * （onsen→温泉、activity→体験、town→街歩き、culture→歴史、nature→絶景）にそろえ、tags と合わせて数えた。
 * 同行者を表す tag（ひとり旅・友人・家族）は数えない。
 */
/** 「誰と行く場所か」を表す tag は、心が動く対象ではないので数えない（友人と雪景色に、…とならないように） */
const COMPANION_TAGS = new Set(["ひとり旅", "友人", "家族"]);

export function topTraitsOf(spots: Pick<Spot, "category" | "tags">[], n = 5): string[] {
  const count = new Map<string, number>();
  const first = new Map<string, number>();
  for (const s of spots) {
    for (const t of new Set([CATEGORY_TRAIT[s.category], ...s.tags].filter((x) => x && !COMPANION_TAGS.has(x)))) {
      count.set(t, (count.get(t) ?? 0) + 1);
      if (!first.has(t)) first.set(t, first.size);
    }
  }
  return [...count].sort((a, b) => b[1] - a[1] || first.get(a[0])! - first.get(b[0])!).slice(0, n).map(([t]) => t);
}

export function computeTendency(args: { answers: AnswerRowLite[]; ratingCount: number; likedSpots: Pick<Spot, "category" | "tags">[] }): Tendency {
  const wantsQ = QUESTIONS.find((q) => q.id === "wants")!;
  const wantsAnswers = args.answers.filter((a) => a.questionId === "wants" && Array.isArray(a.value));
  const counts = new Map<string, number>();
  for (const a of wantsAnswers) for (const o of a.value as unknown[]) if (typeof o === "string") counts.set(o, (counts.get(o) ?? 0) + 1);
  const wants = wantsQ
    .options!.map((label, i) => ({ label, count: counts.get(label) ?? 0, i }))
    .filter((w) => w.count > 0)
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .map(({ label, count }) => {
      const share = wantsAnswers.length ? count / wantsAnswers.length : 0;
      return { label, count, share, tone: toneOf(share) };
    });

  const axes: AxisView[] = AXES.map(({ id, title }) => {
    const q = QUESTIONS.find((x) => x.id === id)!;
    const vals = args.answers.filter((a) => a.questionId === id && typeof a.value === "number").map((a) => a.value as number);
    const n = vals.length;
    const avg = n ? vals.reduce((a, b) => a + b, 0) / n : null;
    const enough = n >= MIN_ANSWERS && avg !== null;
    return {
      id, title, left: q.left!, right: q.right!, n, avg,
      position: enough ? Math.min(1, Math.max(0, (avg - 1) / 4)) : null,
      word: enough ? wordFor(id, avg) : null,
      remaining: Math.max(0, MIN_ANSWERS - n),
    };
  });
  return { ratingCount: args.ratingCount, wants, axes, topTraits: topTraitsOf(args.likedSpots) };
}
