"use client";

import { Check, Copy, Plus, Send } from "lucide-react";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { BottomBar, PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { MEMBER_STATUS, MOCK_CODE } from "@/lib/mock/data";

export function Invite({ tripId }: { tripId: string }) {
  const [copied, setCopied] = useState(false);
  const link = () => `${window.location.origin}/j/${MOCK_CODE}`;

  const sendLine = () => {
    const text = `旅の行き先を一緒に決めよう！質問に答えるだけで2分で終わります。\n${link()}\n招待コード：${MOCK_CODE}`;
    window.open(`https://line.me/R/share?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${link()}\n招待コード：${MOCK_CODE}`);
    } catch {
      // クリップボードが使えない環境でも表示だけは出す
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Header left={{ type: "back", href: "/trips/new" }} title="みんなを招待" />
      <main className="screen has-action content">
        <section className="card invite-code" style={{ marginTop: 20 }}>
          <strong aria-label={`招待コード ${MOCK_CODE}`}>{MOCK_CODE}</strong>
          <p className="lead">リンクを開くか、コードを入れると参加できます。アプリはいりません。</p>
        </section>
        <p className="sub" style={{ marginTop: 14, textAlign: "center" }}>コードを送ると、アプリなしで参加できます。</p>

        <div className="stack" style={{ marginTop: 16 }}>
          <SecondaryButton onClick={sendLine}>
            <Send size={18} strokeWidth={2} aria-hidden="true" />
            LINEで送る
          </SecondaryButton>
          <SecondaryButton onClick={copy}>
            {copied ? <Check size={18} strokeWidth={2} aria-hidden="true" /> : <Copy size={18} strokeWidth={2} aria-hidden="true" />}
            {copied ? "コピーしました" : "コードをコピー"}
          </SecondaryButton>
          <p className="sr-only" role="status">{copied ? "コピーしました" : ""}</p>
        </div>

        <section className="card" style={{ marginTop: 20, padding: "6px 16px" }}>
          <div className="row-between" style={{ minHeight: 52 }}>
            <h2 style={{ fontSize: 16 }}>参加の状況</h2>
            {/* TODO(spec): 「＋ 人を追加」を押したときの動き（名前の入力と members への追加）は段階3で入れる。 */}
            <button type="button" className="small-btn">
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              人を追加
            </button>
          </div>
          {MEMBER_STATUS.map((m) => (
            <div className="member-row" key={m.name}>
              <span className="avatar">{m.name.slice(0, 1)}</span>
              <b>{m.name}</b>
              <span className={`status-chip ${m.status === "回答済み" ? "done" : ""}`}>{m.status}</span>
            </div>
          ))}
        </section>

        <section className="card" style={{ marginTop: 16, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14 }}>記録を残す（任意）</h3>
            <p className="sub" style={{ marginTop: 2 }}>アカウントを作ると、ほかの端末でも旅と行きたい場所が見られます。</p>
          </div>
          {/* TODO(spec): アカウント作成（linkIdentity / updateUser）は段階6。 */}
          <button type="button" className="small-btn">作る</button>
        </section>
      </main>
      <BottomBar>
        <PrimaryButton href={`/trips/${tripId}/q/1`}>自分の回答をはじめる</PrimaryButton>
      </BottomBar>
    </>
  );
}
