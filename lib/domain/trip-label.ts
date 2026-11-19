import type { Companion, Nights } from "./questions";

export function monthsLabel(months: number[]): string {
  if (months.length === 0) return "時期未定";
  const sorted = [...months];
  const contiguous = sorted.every((m, i) => i === 0 || m === (sorted[i - 1] % 12) + 1);
  if (sorted.length >= 2 && contiguous) return `${sorted[0]}〜${sorted[sorted.length - 1]}月`;
  return `${sorted.join("・")}月`;
}

export const NIGHTS_LABEL: Record<Nights, string> = {
  day: "日帰り",
  "1": "1泊",
  "2": "2泊",
  "3plus": "3泊以上",
  undecided: "泊数未定",
};

export const COMPANION_LABEL: Record<Companion, string> = {
  solo: "ひとり",
  friends: "友人",
  partner: "恋人",
  family_kids: "家族（小さい子あり）",
  family_adults: "家族（大人のみ）",
  undecided: "同行者未定",
};

/** 例：1〜2月・1泊・友人4人 */
export function tripSummary(args: { months: number[]; nights: Nights; companion: Companion; memberCount: number }) {
  const who =
    args.companion === "solo"
      ? "ひとり"
      : args.companion === "undecided"
        ? `${args.memberCount}人`
        : `${COMPANION_LABEL[args.companion]}${args.memberCount}人`;
  return `${monthsLabel(args.months)}・${NIGHTS_LABEL[args.nights]}・${who}`;
}
