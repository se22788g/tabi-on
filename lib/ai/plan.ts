// A2 工程案を作る。
// TODO(spec): 段階5で、ここに AI の呼び出しを足す。AIの出力は、必ず sanitizePlan（lib/domain/plan-rules.ts）を通す。
// 失敗・時間切れ・検査エラーのときは、やり直さず、すぐルール版（lib/ai/fallback/plan.ts）を使う。段階3では、ルール版だけで動く。
import { sanitizePlan, type PlanOut } from "@/lib/domain/plan-rules";
import { rulePlan, type PlanRuleInput } from "./fallback/plan";

export type PlanResult = { source: "ai" | "rule"; plan: PlanOut };

export async function createPlan(input: PlanRuleInput): Promise<PlanResult> {
  const plan = sanitizePlan(rulePlan(input), {
    knownSpotIds: new Set(input.spots.keys()),
    removedSpotIds: input.removedSpotIds,
    kept: input.kept,
    maxPerDay: 5,
  });
  return { source: "rule", plan };
}
