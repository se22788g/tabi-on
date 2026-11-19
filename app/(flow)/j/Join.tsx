"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Header, Logo } from "@/components/layout/Header";
import { BottomBar, PrimaryButton } from "@/components/ui/buttons";
import { MOCK_CODE, MOCK_TRIP_ID } from "@/lib/mock/data";
import { tripSummary } from "@/lib/domain/trip-label";
import { MOCK_CONDITIONS, MOCK_MEMBER_COUNT } from "@/lib/mock/data";

const OTHERS = ["みさき", "けんた", "ゆうこ"];
const NEW_NAME = "__new__";

export function Join({ code }: { code?: string }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const valid = code?.toUpperCase() === MOCK_CODE;

  if (!valid) {
    return (
      <>
        <Header center={<Logo />} />
        <main className="screen has-action content">
          <div style={{ paddingTop: 24 }}>
            <h1>招待コードを入れてください</h1>
            <p className="lead">コードは、招待のメッセージに書かれています。</p>
          </div>
          <input
            className="text-input"
            style={{ marginTop: 20, textTransform: "uppercase", letterSpacing: "0.08em" }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="TABI-XXXX"
            aria-label="招待コード"
          />
        </main>
        <BottomBar>
          {/* TODO(spec): コード入力後のボタンの文言は文言一覧にない。仮に「参加する」。 */}
          <PrimaryButton disabled={!input.trim()} onClick={() => router.push(`/j/${encodeURIComponent(input.trim())}`)}>
            参加する
          </PrimaryButton>
        </BottomBar>
      </>
    );
  }

  const ready = picked !== null && (picked !== NEW_NAME || newName.trim().length > 0);
  return (
    <>
      <Header center={<Logo />} />
      <main className="screen has-action content">
        <div style={{ paddingTop: 20, textAlign: "center" }}>
          <h1>あやさんから旅の招待が届いています</h1>
          <p className="lead">質問に答えるだけで、行き先づくりに参加できます。</p>
        </div>
        <div className="card" style={{ marginTop: 18, padding: 14, textAlign: "center", fontWeight: 900 }}>
          {tripSummary({ ...MOCK_CONDITIONS, memberCount: MOCK_MEMBER_COUNT })}
        </div>
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>あなたはどの人？</h2>
          <div className="chips">
            {OTHERS.map((n) => (
              <button key={n} type="button" className="round-choice" aria-pressed={picked === n} onClick={() => setPicked(n)}>
                <span className="avatar">{n.slice(0, 1)}</span>
                {n}
              </button>
            ))}
            <button type="button" className="round-choice" aria-pressed={picked === NEW_NAME} onClick={() => setPicked(NEW_NAME)}>
              リストにない（名前を入れる）
            </button>
          </div>
          {picked === NEW_NAME && (
            <input
              className="text-input"
              style={{ marginTop: 12 }}
              value={newName}
              maxLength={10}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="あなたの名前"
              aria-label="あなたの名前"
            />
          )}
        </section>
      </main>
      <BottomBar>
        <PrimaryButton disabled={!ready} href={`/trips/${MOCK_TRIP_ID}/q/1`}>
          参加して質問に答える
        </PrimaryButton>
      </BottomBar>
    </>
  );
}
