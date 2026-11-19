"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CheckRow } from "@/components/ui/choices";
import { PrimaryButton } from "@/components/ui/buttons";
import { Loading, SetupNotice } from "@/components/ui/Loading";
import { fetchAllSpots, memberFromRow, resumeHref, type MemberInfo } from "@/lib/db/queries";
import { useSupabase } from "@/lib/db/use-supabase";
import type { Companion, Nights } from "@/lib/domain/questions";
import type { Spot } from "@/lib/domain/spot";
import { monthsLabel, NIGHTS_LABEL } from "@/lib/domain/trip-label";

type Status = "collecting" | "decided" | "done";
type TripCard = { id: string; title: string | null; condition: string; members: MemberInfo[]; status: Status; chip: string; href: string };

const GROUPS: { status: Status; title: string }[] = [
  { status: "collecting", title: "すすめている旅" },
  { status: "decided", title: "決まった旅" },
  { status: "done", title: "行った旅" },
];

type Row = {
  id: string; companion: Companion; months: number[] | null; nights: Nights | null; status: Status;
  members: { id: string; name: string; user_id: string | null; is_owner: boolean | null; answered_at: string | null; rated_at: string | null; seq: number }[];
  plans: { title: string } | { title: string }[] | null;
};

export function TripList() {
  const sb = useSupabase();
  const client = sb.status === "ready" ? sb.client : null;
  const userId = sb.status === "ready" ? sb.userId : null;
  const [trips, setTrips] = useState<TripCard[] | null>(null);
  const [spots, setSpots] = useState<Map<string, Spot>>(new Map());
  const [recordFor, setRecordFor] = useState<TripCard | null>(null);
  const [planSpotIds, setPlanSpotIds] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [recorded, setRecorded] = useState<string[]>([]);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    (async () => {
      const { data } = await client
        .from("trips")
        .select("id, companion, months, nights, status, members(id, name, user_id, is_owner, answered_at, rated_at, seq), plans(title)")
        .order("created_at", { ascending: false });
      if (!alive) return;
      const list: TripCard[] = ((data ?? []) as unknown as Row[]).map((t) => {
        const members = [...t.members].sort((a, b) => a.seq - b.seq).map(memberFromRow);
        const me = members.find((m) => m.userId === userId);
        const plan = Array.isArray(t.plans) ? t.plans[0] : t.plans;
        const ratedCount = members.filter((m) => m.ratedAt).length;
        // 自分が回答し終えていなければ続きの F 画面、終えていれば M3
        const href = me ? resumeHref(t.id, me) : `/trips/${t.id}/plan`;
        const chip =
          t.status !== "collecting" ? "決定" : me && !me.ratedAt ? "あなたの回答待ち" : `${members.length}人中${ratedCount}人が回答`;
        return {
          id: t.id,
          title: plan?.title ?? null,
          condition: `${monthsLabel(t.months ?? [])}・${NIGHTS_LABEL[t.nights ?? "undecided"]}`,
          members,
          status: t.status,
          chip,
          href,
        };
      });
      setTrips(list);
    })();
    return () => {
      alive = false;
    };
  }, [client, userId]);

  // 「行った場所を記録する」：工程案の予定をチェックボックス付きで並べ、選んだ場所を「行った」にする
  const openRecord = async (t: TripCard) => {
    if (!client) return;
    setRecordFor(t);
    setChecked([]);
    const [{ data: items }, { data: visits }, all] = await Promise.all([
      client.from("plan_items").select("spot_id, day, position").eq("trip_id", t.id).order("day").order("position"),
      client.from("visits").select("spot_id"),
      spots.size ? Promise.resolve([...spots.values()]) : fetchAllSpots(client),
    ]);
    setSpots(new Map(all.map((s) => [s.id, s])));
    setPlanSpotIds(Array.from(new Set((items ?? []).map((i) => i.spot_id as string | null).filter((x): x is string => Boolean(x)))));
    setRecorded((visits ?? []).map((v) => v.spot_id as string));
  };

  const record = async () => {
    if (!client || !userId) return;
    await client.from("visits").upsert(checked.map((spot_id) => ({ user_id: userId, spot_id })), { onConflict: "user_id,spot_id", ignoreDuplicates: true });
    setRecorded([...recorded, ...checked]);
    setRecordFor(null);
  };

  if (sb.status === "unconfigured" || sb.status === "failed") return <SetupNotice status={sb.status} />;
  if (!trips) return <Loading />;

  if (trips.length === 0) {
    return (
      <main className="screen has-tabbar content">
        <div className="empty">
          <h2>まだ旅はありません</h2>
          <div style={{ width: "100%" }}>
            <PrimaryButton href="/trips/new">旅をはじめる</PrimaryButton>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="screen has-tabbar content">
      {GROUPS.map((g) => {
        const list = trips.filter((t) => t.status === g.status);
        if (list.length === 0) return null;
        return (
          <section key={g.status} style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 10 }}>{g.title}</h2>
            <div className="stack">
              {list.map((t) => (
                <div key={t.id} className="card trip-card">
                  <Link href={t.href} style={{ display: "grid", gap: 8, textDecoration: "none" }}>
                    <h3 style={{ fontSize: 17 }}>{t.title ?? "まだ行き先が決まっていない旅"}</h3>
                    <span className="sub">{t.condition}</span>
                    <span className="row-between">
                      <span className="avatar-row" aria-hidden="true">
                        {t.members.map((m) => (
                          <span key={m.id} className="avatar">{m.name.slice(0, 1)}</span>
                        ))}
                      </span>
                      <span className="status-chip">{t.chip}</span>
                    </span>
                  </Link>
                  {t.status === "decided" && (
                    <button type="button" className="small-btn" style={{ justifySelf: "start" }} onClick={() => void openRecord(t)}>
                      行った場所を記録する
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <BottomSheet open={recordFor !== null} onClose={() => setRecordFor(null)} title="行った場所を記録する">
        <div className="stack" style={{ paddingBottom: 12 }}>
          {planSpotIds.map((id) => {
            const s = spots.get(id);
            if (!s) return null;
            return (
              <CheckRow
                key={id}
                label={recorded.includes(id) ? `${s.name}（記録ずみ）` : s.name}
                selected={checked.includes(id)}
                onClick={() => setChecked(checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id])}
              />
            );
          })}
          {/* TODO(spec): 記録ボタンの文言は文言一覧にない。仮に「記録する」。 */}
          <PrimaryButton disabled={checked.length === 0} onClick={() => void record()}>
            記録する
          </PrimaryButton>
        </div>
      </BottomSheet>
    </main>
  );
}
