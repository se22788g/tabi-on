// 回答の集計（仕様書：複数選択は選択肢ごとの人数、5段階は平均）。AIを使わない。公平であるべきなのでルール。
import { QUESTIONS } from "./questions";

export type AnswerRow = { memberId: string; questionId: string; value: unknown };

export type Aggregate = {
  /** 複数選択：問いの id → 選択肢 → 選んだ人数 */
  multi: Record<string, Record<string, number>>;
  /** 5段階：問いの id → 平均（1〜5）と答えた人数 */
  scale: Record<string, { avg: number | null; n: number }>;
  /** 「行きたい場所」で追加された spot の id（全員分、重複なし） */
  places: string[];
  /** 何人分の回答か */
  members: number;
};

const KIND = new Map(QUESTIONS.map((q) => [q.id, q.kind]));

export function aggregateAnswers(rows: AnswerRow[]): Aggregate {
  const multi: Aggregate["multi"] = {};
  const sums: Record<string, { sum: number; n: number }> = {};
  const places = new Set<string>();
  const members = new Set<string>();
  for (const r of rows) {
    members.add(r.memberId);
    const kind = KIND.get(r.questionId);
    if (kind === "multi" && Array.isArray(r.value)) {
      const m = (multi[r.questionId] ??= {});
      for (const o of r.value) if (typeof o === "string") m[o] = (m[o] ?? 0) + 1;
    } else if (kind === "scale" && typeof r.value === "number") {
      const s = (sums[r.questionId] ??= { sum: 0, n: 0 });
      s.sum += r.value;
      s.n += 1;
    } else if (kind === "places" && Array.isArray(r.value)) {
      for (const id of r.value) if (typeof id === "string") places.add(id);
    }
  }
  const scale: Aggregate["scale"] = {};
  for (const q of QUESTIONS) {
    if (q.kind !== "scale") continue;
    const s = sums[q.id];
    scale[q.id] = { avg: s ? s.sum / s.n : null, n: s?.n ?? 0 };
  }
  return { multi, scale, places: [...places], members: members.size };
}

/** 1人分の回答（問いの id → 値） */
export function answersOf(rows: AnswerRow[], memberId: string): Record<string, unknown> {
  return Object.fromEntries(rows.filter((r) => r.memberId === memberId).map((r) => [r.questionId, r.value]));
}
