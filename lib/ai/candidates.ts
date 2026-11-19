// A1 おすすめを作る。
// TODO(spec): 段階5で、ここに AI（Anthropic API）の呼び出しを足す。AIが失敗・時間切れ・検査エラーのときは、
// やり直さず、すぐルール版（lib/ai/fallback/candidates.ts）を使う。段階3では、ルール版だけで動く（source = 'rule'）。
import { sanitizeCandidates, type CandidateOut } from "@/lib/domain/candidate-rules";
import { ruleCandidates, type CandidateRuleInput } from "./fallback/candidates";

export type CandidatesResult = { source: "ai" | "rule"; candidates: CandidateOut[] };

export async function createCandidates(input: CandidateRuleInput): Promise<CandidatesResult> {
  const known = new Set([...input.spots, ...input.forced].map((s) => s.id));
  const candidates = sanitizeCandidates(ruleCandidates(input), known);
  return { source: "rule", candidates };
}
