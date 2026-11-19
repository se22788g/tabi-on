"use client";

import { Check, Copy, Plus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { BottomBar, PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { Loading, SetupNotice } from "@/components/ui/Loading";
import { fetchTrip, type MemberInfo, type TripInfo } from "@/lib/db/queries";
import { useSupabase } from "@/lib/db/use-supabase";

const POLL_MS = 4000;
const MAX_MEMBERS = 12;

type Status = "まだ" | "回答中" | "回答済み";
const statusOf = (m: MemberInfo): Status => (!m.userId ? "まだ" : m.answeredAt ? "回答済み" : "回答中");

export function Invite({ tripId }: { tripId: string }) {
  const router = useRouter();
  const sb = useSupabase();
  const [data, setData] = useState<{ trip: TripInfo; members: MemberInfo[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const client = sb.status === "ready" ? sb.client : null;
  const userId = sb.status === "ready" ? sb.userId : null;

  const load = useCallback(async () => {
    if (!client) return;
    const r = await fetchTrip(client, tripId);
    if (!r) router.replace("/trips");
    else setData(r);
  }, [client, tripId, router]);

  useEffect(() => {
    void load();
    // TODO(spec): 参加状況の更新は、いまは4秒ごとに読み直している。Supabase Realtime での更新は段階6。
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  if (sb.status === "unconfigured" || sb.status === "failed") return <SetupNotice status={sb.status} />;
  if (!data) return <Loading />;

  const { trip, members } = data;
  const code = trip.code;
  const isOwner = trip.ownerId === userId;
  const link = () => `${window.location.origin}/j/${code}`;

  const sendLine = () => {
    const text = `旅の行き先を一緒に決めよう！質問に答えるだけで2分で終わります。\n${link()}\n招待コード：${code}`;
    window.open(`https://line.me/R/share?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${link()}\n招待コード：${code}`);
    } catch {
      // クリップボードが使えない環境でも表示だけは出す
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  // TODO(spec): 「＋ 人を追加」の動き（名前を入力して members に足す。言い出し役だけ）は仕様書に詳しい決まりがない。F1 と同じ決まり
  // （1〜10文字、最大12人、同じ名前は「あや（2）」）で、BottomSheet に名前を入れる形にした。
  const addMember = async () => {
    const raw = name.trim();
    if (raw.length < 1 || raw.length > 10) return setNameError("名前は1〜10文字で入れてください");
    if (members.length >= MAX_MEMBERS) return setNameError("一緒に行く人は、あなたを入れて12人までです");
    const taken = new Set(members.map((m) => m.name));
    let unique = raw;
    for (let n = 2; taken.has(unique); n++) unique = `${raw}（${n}）`;
    const { error } = await client!.from("members").insert({ trip_id: tripId, name: unique });
    if (error) return setNameError("追加できませんでした。もう一度ためしてください");
    setName("");
    setNameError("");
    setAdding(false);
    void load();
  };

  return (
    <>
      <Header left={{ type: "back", href: "/trips/new" }} title="みんなを招待" />
      <main className="screen has-action content">
        <section className="card invite-code" style={{ marginTop: 20 }}>
          <strong aria-label={`招待コード ${code}`}>{code}</strong>
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
            {isOwner && (
              <button type="button" className="small-btn" onClick={() => setAdding(true)}>
                <Plus size={16} strokeWidth={2} aria-hidden="true" />
                人を追加
              </button>
            )}
          </div>
          {members.map((m) => {
            const st = statusOf(m);
            const mine = m.userId === userId;
            return (
              <div className="member-row" key={m.id}>
                <span className="avatar">{m.name.slice(0, 1)}</span>
                <b>{mine ? "あなた" : m.name}</b>
                <span className={`status-chip ${st === "回答済み" ? "done" : ""}`}>{st}</span>
              </div>
            );
          })}
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

      <BottomSheet open={adding} onClose={() => setAdding(false)} title="人を追加">
        <div className="stack" style={{ paddingBottom: 12 }}>
          <input
            className="text-input"
            value={name}
            maxLength={10}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void addMember())}
            placeholder="名前を入力"
            aria-label="一緒に行く人の名前"
          />
          {nameError && (
            <p className="sub" role="alert" style={{ color: "#b3261e" }}>
              {nameError}
            </p>
          )}
          <PrimaryButton onClick={() => void addMember()}>追加</PrimaryButton>
        </div>
      </BottomSheet>
    </>
  );
}
