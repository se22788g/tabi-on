import { Lock, Sparkles } from "lucide-react";

export function AiBadge() {
  return (
    <span className="ai-badge">
      <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
      あなたへのおすすめ
    </span>
  );
}

export function PartnerBadge() {
  return <span className="partner-badge">予約できる体験あり</span>;
}

export function PrivacyNote({ children = "だれが何を選んだかは表示されません" }: { children?: string }) {
  return (
    <p className="privacy-note">
      <Lock size={15} strokeWidth={2} aria-hidden="true" />
      {children}
    </p>
  );
}
