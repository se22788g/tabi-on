"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/buttons";
import { isEmailTaken, isRateLimited, isValidEmail } from "@/lib/auth/account";

type Step = "input" | "sent-confirm" | "sent-login";

/**
 * 「メールで続ける」。メールアドレスを入れると、
 * ・まだアカウントがなければ、いまの（匿名の）記録にメールを紐づける確認メールを送る（updateUser）。リンクを開くと、アカウントができる。
 * ・すでに同じメールのアカウントがあれば（別の端末など）、ログイン用のリンクを送る（signInWithOtp）。リンクを開くと、その記録が見られる。
 * TODO(spec): この BottomSheet の文言は、文言一覧にない（仮の文言）。
 */
export function AccountSheet({ open, onClose, client }: { open: boolean; onClose: () => void; client: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    onClose();
    // 送ったあとに閉じたら、次に開くときは、入力からやり直せるようにする
    if (step !== "input") setStep("input");
    setError("");
  };

  const submit = async () => {
    if (busy) return;
    const value = email.trim();
    if (!isValidEmail(value)) return setError("メールアドレスを確かめてください");
    setBusy(true);
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=/me`;
    const { error: e1 } = await client.auth.updateUser({ email: value }, { emailRedirectTo: redirectTo });
    if (!e1) {
      setStep("sent-confirm");
    } else if (isEmailTaken(e1)) {
      // すでにアカウントがある（別の端末など）：ログイン用のリンクを送る。新しいアカウントは作らない
      const { error: e2 } = await client.auth.signInWithOtp({ email: value, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
      if (!e2) setStep("sent-login");
      else setError(isRateLimited(e2) ? "メールを送りすぎました。しばらくしてからもう一度ためしてください" : "送れませんでした。もう一度ためしてください");
    } else {
      setError(isRateLimited(e1) ? "メールを送りすぎました。しばらくしてからもう一度ためしてください" : "送れませんでした。もう一度ためしてください");
    }
    setBusy(false);
  };

  return (
    <BottomSheet open={open} onClose={close} title="メールで続ける">
      {step === "input" ? (
        <form
          noValidate
          className="stack"
          style={{ paddingBottom: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="sub">メールアドレスに、リンクを送ります。リンクを開くと、ほかの端末でも記録が見られます。</p>
          <input
            className="text-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            maxLength={254}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            aria-label="メールアドレス"
          />
          {error && (
            <p className="sub" role="alert" style={{ color: "#b3261e" }}>
              {error}
            </p>
          )}
          <PrimaryButton type="submit" disabled={busy || email.trim().length === 0}>
            送る
          </PrimaryButton>
        </form>
      ) : (
        <div className="stack" style={{ paddingBottom: 12 }} role="status">
          <p style={{ fontWeight: 900 }}>
            {step === "sent-confirm" ? "確認メールを送りました。" : "ログイン用のリンクを送りました。"}
          </p>
          <p className="sub">
            {step === "sent-confirm"
              ? "メールのリンクを開くと、アカウントができます。いまの記録は、そのまま残ります。"
              : "メールのリンクを開くと、あなたの記録が見られます。"}
          </p>
          <p className="sub min">{email.trim()}</p>
        </div>
      )}
    </BottomSheet>
  );
}
