import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicEnv } from "./env";

/**
 * サーバー用の Supabase クライアント（anon キー＋ログイン中の人のクッキー）。
 * 権限は、ログイン中の人として RLS で判定される。環境変数が無ければ null。
 * TODO(spec): ログインの有効期限を延ばす処理（middleware でのトークン更新）は、サーバーで本物のデータを読む段階3で入れる。
 */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  const env = getPublicEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Component からは書けない。トークン更新は middleware 側の役目（上の TODO）
        }
      },
    },
  });
}
