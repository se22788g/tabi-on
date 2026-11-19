// 質問の定義と出し分け（仕様書「F4 質問」の表）。AIは使わない。

export type Companion =
  | "solo"
  | "friends"
  | "partner"
  | "family_kids"
  | "family_adults"
  | "undecided";

export type Nights = "day" | "1" | "2" | "3plus" | "undecided";

export type TripConditions = {
  companion: Companion;
  /** 空なら未定 */
  months: number[];
  nights: Nights;
};

export type QuestionKind = "multi" | "scale" | "places";

export type Question = {
  id: string;
  title: string;
  kind: QuestionKind;
  options?: string[];
  /** 5段階の左端・右端 */
  left?: string;
  right?: string;
};

export const SEASON_OPTIONS = {
  winter: ["雪景色を見る", "露天風呂", "郷土料理", "雪あそび", "カフェめぐり"],
  spring: ["お花見", "新緑の散歩", "いちご狩り", "春の味覚", "カフェめぐり"],
  summer: ["海・川あそび", "花火・夏祭り", "高原で涼む", "星空を見る", "夏の味覚"],
  autumn: ["紅葉を見る", "味覚狩り", "秋の味覚", "美術館・アート", "カフェめぐり"],
  undecided: ["景色を見る", "温泉", "郷土料理", "アクティビティ", "カフェめぐり"],
} as const;

export type Season = keyof typeof SEASON_OPTIONS;

export const SEASON_LABEL: Record<Exclude<Season, "undecided">, string> = {
  winter: "冬",
  spring: "春",
  summer: "夏",
  autumn: "秋",
};

export function seasonOfMonth(month: number): Exclude<Season, "undecided"> {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}

/**
 * 時期を複数選んだときは「一番早い月」の季節を使う。
 * TODO(spec): 12月と1月のように年をまたぐ場合の「一番早い月」。仮に、配列の先頭（選んだ順の先頭ではなく、今月から数えた並びの先頭）を使う。
 */
export function seasonOf(months: number[]): Season {
  if (months.length === 0) return "undecided";
  return seasonOfMonth(months[0]);
}

export const QUESTIONS: Question[] = [
  {
    id: "wants",
    title: "今回の旅で、したいことは？",
    kind: "multi",
    options: ["食べる", "自然・景色", "温泉・いやし", "体験・アクティビティ", "街歩き・買い物", "歴史・文化"],
  },
  { id: "pace", title: "旅のペースは？", kind: "scale", left: "ゆったり", right: "アクティブ" },
  {
    id: "moments",
    title: "どんな時間を大事にしたい？",
    kind: "multi",
    options: ["みんなで話す", "写真を撮る", "おいしいもの", "非日常を味わう", "のんびりする"],
  },
  { id: "style", title: "過ごし方の好みは？", kind: "scale", left: "予定少なめ", right: "ぎっしり" },
  { id: "season", title: "{季節}なら何をしてみたい？", kind: "multi" },
  {
    id: "travel_time",
    title: "移動時間はどのくらい平気？",
    kind: "scale",
    left: "短めがいい",
    right: "遠くてもOK",
  },
  {
    id: "transport",
    title: "どうやって行きたい？",
    kind: "multi",
    options: ["電車・新幹線", "車（運転できる）", "飛行機もOK", "こだわらない"],
  },
  {
    id: "stay",
    title: "泊まるなら、どんな宿？",
    kind: "multi",
    options: ["温泉旅館", "ホテル", "古民家・一棟貸し", "コスパ重視", "宿は未定"],
  },
  { id: "vibe", title: "行き先の雰囲気は？", kind: "scale", left: "定番", right: "穴場" },
  {
    id: "food",
    title: "食の好みを教えて",
    kind: "multi",
    options: ["ご当地グルメ", "海鮮", "お肉", "甘いもの", "お酒", "特になし"],
  },
  { id: "budget", title: "予算の気分は？", kind: "scale", left: "おさえたい", right: "少し贅沢" },
  { id: "places", title: "具体的に行きたい場所はある？", kind: "places" },
];

/** 出し分けと文言の差し替えをすませた、画面に出す問い */
export function visibleQuestions(trip: TripConditions): Question[] {
  const season = seasonOf(trip.months);
  const list: Question[] = [];
  for (const q of QUESTIONS) {
    if (q.id === "stay" && trip.nights === "day") continue;
    if (q.id === "moments" && trip.companion === "solo") {
      list.push({ ...q, options: q.options!.map((o) => (o === "みんなで話す" ? "ひとりの時間" : o)) });
      continue;
    }
    if (q.id === "food" && trip.companion === "family_kids") {
      list.push({ ...q, options: q.options!.map((o) => (o === "お酒" ? "子どもも食べやすい" : o)) });
      continue;
    }
    if (q.id === "season") {
      list.push({
        ...q,
        title: season === "undecided" ? "旅先で何をしてみたい？" : `${SEASON_LABEL[season]}なら何をしてみたい？`,
        options: [...SEASON_OPTIONS[season]],
      });
      continue;
    }
    list.push(q);
  }
  return list;
}

/** 補足の一文（文言一覧 F4） */
export function questionHint(q: Question): string | null {
  if (q.kind === "multi") return "いくつでも選べます";
  if (q.kind === "scale") return "近いほうを選んでください";
  // TODO(spec): 「具体的に行きたい場所」の補足文は文言一覧にない。Figmaの文言を仮に使う。
  return "なくても大丈夫。思いつく場所を追加できます";
}
