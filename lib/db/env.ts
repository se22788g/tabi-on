import { z } from "zod";

const publicSchema = z.object({ url: z.string().url(), anonKey: z.string().min(1) });

/**
 * ブラウザにも出してよい値（URL と anon キー）。未設定なら null を返す。
 * NEXT_PUBLIC_ の値は、ビルド時に埋め込まれるので、process.env.NEXT_PUBLIC_xxx と直接書く。
 * キーが無いときも、段階1の仮データの画面は動かす（匿名ログインだけ行わない）。
 */
export function getPublicEnv(): { url: string; anonKey: string } | null {
  const parsed = publicSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return parsed.success ? parsed.data : null;
}
