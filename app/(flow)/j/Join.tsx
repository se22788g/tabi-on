"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header, Logo } from "@/components/layout/Header";
import { BottomBar, PrimaryButton } from "@/components/ui/buttons";
import { Loading, SetupNotice } from "@/components/ui/Loading";
import { memberFromRow, resumeHref } from "@/lib/db/queries";
import { useSupabase } from "@/lib/db/use-supabase";
import type { Companion, Nights } from "@/lib/domain/questions";
import { tripSummary } from "@/lib/domain/trip-label";

const NEW_NAME = "__new__";

type Invite = {
  owner_name: string | null;
  companion: Companion;
  months: number[];
  nights: Nights;
  member_count: number;
  members: { id: string; name: string; joined: boolean }[];
  trip_id: string | null;
  member_id: string | null;
};

export function Join({ code }: { code?: string }) {
  const router = useRouter();
  const sb = useSupabase();
  const [input, setInput] = useState("");
  const [invite, setInvite] = useState<Invite | null | "none">(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const client = sb.status === "ready" ? sb.client : null;

  useEffect(() => {
    if (!client) return;
    if (!code) return setInvite("none");
    let alive = true;
    (async () => {
      const { data } = await client.rpc("get_invite", { p_code: code });
      if (!alive) return;
      const inv = data as Invite | null;
      if (!inv) return setInvite("none");
      if (inv.trip_id && inv.member_id) {
        // すでに参加済みの端末なら、続きの画面にそのまま移す
        const { data: me } = await client.from("members").select("*").eq("id", inv.member_id).single();
        if (me) return router.replace(resumeHref(inv.trip_id, memberFromRow(me)));
      }
      setInvite(inv);
    })();
    return () => {
      alive = false;
    };
  }, [client, code, router]);

  if (sb.status === "unconfigured" || sb.status === "failed") return <SetupNotice status={sb.status} />;
  if (invite === null) return <Loading />;

  if (invite === "none") {
    // コードが間違っている、または /j をコードなしで開いたとき
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

  const others = invite.members.filter((m) => !m.joined);
  const ready = picked !== null && (picked !== NEW_NAME || newName.trim().length > 0);

  const join = async () => {
    if (!client || !ready || busy || !code) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await client.rpc("join_trip", {
      p_code: code,
      p_member_id: picked === NEW_NAME ? null : picked,
      p_new_name: picked === NEW_NAME ? newName.trim() : null,
    });
    if (rpcError) {
      // TODO(spec): 参加できなかったときの文言は文言一覧にない（仮の文言）。
      setError(rpcError.message.includes("member_taken") ? "その名前は、ほかの人が使いました。別の名前を選んでください" : "参加できませんでした。もう一度ためしてください");
      setBusy(false);
      setPicked(null);
      const { data: fresh } = await client.rpc("get_invite", { p_code: code });
      if (fresh) setInvite(fresh as Invite);
      return;
    }
    const j = data as { trip_id: string; member_id: string; already: boolean };
    if (j.already) {
      const { data: me } = await client.from("members").select("*").eq("id", j.member_id).single();
      return router.replace(me ? resumeHref(j.trip_id, memberFromRow(me)) : `/trips/${j.trip_id}/q/1`);
    }
    router.push(`/trips/${j.trip_id}/q/1`);
  };

  return (
    <>
      <Header center={<Logo />} />
      <main className="screen has-action content">
        <div style={{ paddingTop: 20, textAlign: "center" }}>
          <h1>{invite.owner_name ?? "友だち"}さんから旅の招待が届いています</h1>
          <p className="lead">質問に答えるだけで、行き先づくりに参加できます。</p>
        </div>
        <div className="card" style={{ marginTop: 18, padding: 14, textAlign: "center", fontWeight: 900 }}>
          {tripSummary({ months: invite.months, nights: invite.nights, companion: invite.companion, memberCount: invite.member_count })}
        </div>
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>あなたはどの人？</h2>
          <div className="chips">
            {others.map((m) => (
              <button key={m.id} type="button" className="round-choice" aria-pressed={picked === m.id} onClick={() => setPicked(m.id)}>
                <span className="avatar">{m.name.slice(0, 1)}</span>
                {m.name}
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
          {error && (
            <p className="sub" role="alert" style={{ marginTop: 12, color: "#b3261e" }}>
              {error}
            </p>
          )}
        </section>
      </main>
      <BottomBar>
        <PrimaryButton disabled={!ready || busy} onClick={join}>
          参加して質問に答える
        </PrimaryButton>
      </BottomBar>
    </>
  );
}
