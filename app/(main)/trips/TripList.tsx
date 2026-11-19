"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CheckRow } from "@/components/ui/choices";
import { PrimaryButton } from "@/components/ui/buttons";
import { PLAN_ITEMS, TRIPS, spotById, type MockTrip } from "@/lib/mock/data";

const GROUPS: { status: MockTrip["status"]; title: string }[] = [
  { status: "collecting", title: "すすめている旅" },
  { status: "decided", title: "決まった旅" },
  { status: "done", title: "行った旅" },
];

export function TripList() {
  const trips = TRIPS;
  const [recordFor, setRecordFor] = useState<MockTrip | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [recorded, setRecorded] = useState<string[]>([]);

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

  const spotIds = Array.from(new Set(PLAN_ITEMS.map((p) => p.spotId)));

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
                  <Link href={t.resumeHref ?? `/trips/${t.id}/plan`} style={{ display: "grid", gap: 8, textDecoration: "none" }}>
                    <h3 style={{ fontSize: 17 }}>{t.title ?? "まだ行き先が決まっていない旅"}</h3>
                    <span className="sub">{t.condition}</span>
                    <span className="row-between">
                      <span className="avatar-row" aria-hidden="true">
                        {t.members.map((m) => (
                          <span key={m} className="avatar">{m.slice(0, 1)}</span>
                        ))}
                      </span>
                      <span className="status-chip">{t.chip}</span>
                    </span>
                  </Link>
                  {t.status === "decided" && (
                    <button type="button" className="small-btn" style={{ justifySelf: "start" }} onClick={() => { setRecordFor(t); setChecked([]); }}>
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
          {spotIds.map((id) => (
            <CheckRow
              key={id}
              label={recorded.includes(id) ? `${spotById(id)!.name}（記録ずみ）` : spotById(id)!.name}
              selected={checked.includes(id)}
              onClick={() => setChecked(checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id])}
            />
          ))}
          {/* TODO(spec): 記録ボタンの文言は文言一覧にない。仮に「記録する」。段階4で visits に保存する。 */}
          <PrimaryButton
            disabled={checked.length === 0}
            onClick={() => {
              setRecorded([...recorded, ...checked]);
              setRecordFor(null);
            }}
          >
            記録する
          </PrimaryButton>
        </div>
      </BottomSheet>
    </main>
  );
}
