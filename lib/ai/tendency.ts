// A3 傾向のひとこと。
// TODO(spec): 段階5で、ここに AI の呼び出しを足す（失敗・時間切れ・検査エラーのときは、やり直さず、すぐルール版を使う）。
// 段階4では、ルール版だけで動く（source = 'rule'。AiBadge は付けない）。
import { ruleHeadline } from "./fallback/tendency";

export type HeadlineResult = { source: "ai" | "rule"; headline: string | null };

export async function createHeadline(args: { topTraits: string[] }): Promise<HeadlineResult> {
  return { source: "rule", headline: ruleHeadline(args.topTraits) };
}
