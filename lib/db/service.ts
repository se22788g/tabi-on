import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * サービスロールのクライアント。RLS を通り抜けるので、サーバーの中だけで使う（参加の処理、ほかの人の度合いの集計、
 * おすすめ・工程案の保存）。キーをブラウザに出さない：'server-only' で、クライアントの部品から import するとビルドが止まる。
 */
export function getServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY と NEXT_PUBLIC_SUPABASE_URL が設定されていません（.env.local）");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
