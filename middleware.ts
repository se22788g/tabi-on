import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/db/env";

/**
 * サーバー側のログイン更新（段階2で先送りにしたもの）。
 * 画面を開くたびに、期限が近いログインを更新して、クッキーに書き直す。
 * getClaims は、署名をその場で確かめるので、毎回 Supabase に問い合わせない（期限切れのときだけ更新する）。
 */
export async function middleware(request: NextRequest) {
  const env = getPublicEnv();
  if (!env) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await supabase.auth.getClaims();
  } catch {
    // まだログインしていない、または Supabase に届かないときも、画面は開く（ブラウザ側で匿名ログインする）
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
