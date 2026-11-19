// アカウント登録（メールのみ）の、画面に依存しない部分。
// 「アカウントを作る」は、匿名ユーザーにメールを紐づける操作（updateUser({ email })。確認メールのリンクで完了）。
// ほかの端末では、同じメールにログイン用のリンクを送って（signInWithOtp）、同じ記録を見る。

type AuthErrorLike = { status?: number; code?: string; message?: string } | null | undefined;

/** そのメールアドレスは、すでにアカウントがある（updateUser が断られた）。このときは、ログイン用のリンクを送る */
export function isEmailTaken(e: AuthErrorLike): boolean {
  if (!e) return false;
  if (e.code === "email_exists" || e.code === "identity_already_exists") return true;
  return /already (been )?registered|already exists|email_exists/i.test(e.message ?? "");
}

/** 短い時間に何度も送った（Supabase の送信回数の上限） */
export function isRateLimited(e: AuthErrorLike): boolean {
  if (!e) return false;
  return e.status === 429 || e.code === "over_email_send_rate_limit" || e.code === "over_request_rate_limit" || /rate limit/i.test(e.message ?? "");
}

/** 形だけの確認（本物の確認は、確認メールが届くかどうか） */
export function isValidEmail(s: string): boolean {
  const v = s.trim();
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** メールのリンクを開いたあとに戻す先。このサイトの中の道だけを許す（外のサイトへ飛ばされないように） */
export function safeNext(next: string | null | undefined, fallback = "/me"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}

/** 「アカウントがある」＝匿名ではなく、メールアドレスがある */
export function accountEmail(user: { is_anonymous?: boolean; email?: string | null } | null | undefined): string | null {
  if (!user || user.is_anonymous) return null;
  return user.email ?? null;
}
