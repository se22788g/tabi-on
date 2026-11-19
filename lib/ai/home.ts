// A4 マイページのおすすめ。
// TODO(spec): 段階5で、ここに AI の呼び出しを足す（失敗・時間切れ・検査エラーのときは、やり直さず、すぐルール版を使う）。
// AIの出力は、存在しない spot_id を捨て、行った場所と「まだ行けていない場所」を除いてから使う。
// 段階4では、ルール版だけで動く（source = 'rule'。AiBadge は付けない）。
import { ruleHome, type HomeItem } from "./fallback/home";

export type HomeResult = { source: "ai" | "rule"; items: HomeItem[] };

export async function createHome(args: Parameters<typeof ruleHome>[0]): Promise<HomeResult> {
  return { source: "rule", items: ruleHome(args) };
}
