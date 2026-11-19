import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 全員を最初に匿名ログインさせる。すでにログインしていれば何もしない。
 * 「アカウントを作る」は、この匿名ユーザーに Google かメールを紐づける操作（段階6）。
 * 戻り値：ログイン中のユーザー id。失敗したら null（アプリは仮データのまま動かす）。
 */
export async function ensureAnonymousSession(supabase: SupabaseClient): Promise<string | null> {
  const { data: current } = await supabase.auth.getSession();
  if (current.session) return current.session.user.id;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn("匿名ログインに失敗しました:", error.message);
    return null;
  }
  return data.user?.id ?? null;
}
