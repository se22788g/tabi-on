import type { SupabaseClient } from "@supabase/supabase-js";

/** いま実行中の匿名ログイン。同時に何か所から呼ばれても、ログインは1回だけにする */
let inflight: Promise<string | null> | null = null;

async function run(supabase: SupabaseClient): Promise<string | null> {
  const { data: current } = await supabase.auth.getSession();
  if (current.session) return current.session.user.id;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn("匿名ログインに失敗しました:", error.message);
    return null;
  }
  return data.user?.id ?? null;
}

/**
 * 全員を最初に匿名ログインさせる。すでにログインしていれば何もしない。
 * 「アカウントを作る」は、この匿名ユーザーにメールを紐づける操作（components/auth/AccountSheet.tsx）。Google ログインは作らない。
 * 戻り値：ログイン中のユーザー id。失敗したら null（アプリは仮データのまま動かす）。
 *
 * 同時に呼ばれたときは、実行中のものを待つ。
 * 以前は、画面を開いた最初に、EnsureSession と useSupabase が同時に呼び、ログインが2回起きて、
 * 匿名ユーザーが2人できていた（あとのセッションが勝つので、画面が読んだ user_id と、通信に使われるセッションがずれうる）。
 */
export function ensureAnonymousSession(supabase: SupabaseClient): Promise<string | null> {
  inflight ??= run(supabase).finally(() => {
    inflight = null;
  });
  return inflight;
}
