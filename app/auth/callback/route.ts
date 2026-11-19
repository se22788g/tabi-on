import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/db/server";
import { safeNext } from "@/lib/auth/account";

/**
 * メールのリンク（確認メール・ログイン用のリンク）を開いたときの戻り先。
 * Supabase が付けた code を、ログインに交換して（クッキーに保存して）、マイページに戻す。
 * 戻り先に ?account=confirmed か ?account=failed を付けて、マイページが結果を知らせる。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const supabase = await getServerSupabase();
  const sep = next.includes("?") ? "&" : "?";
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}${sep}account=confirmed`);
  }
  return NextResponse.redirect(`${origin}${next}${sep}account=failed`);
}
