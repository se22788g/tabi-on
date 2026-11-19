"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Loading, SetupNotice } from "@/components/ui/Loading";
import { Photo } from "@/components/ui/Photo";
import { useMyData } from "@/lib/db/my-data";
import { prefectureShort } from "@/lib/domain/spot";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

export function Visited() {
  const my = useMyData();
  if (my.status === "unconfigured" || my.status === "failed") return <SetupNotice status={my.status} />;
  if (my.status !== "ready") return <Loading />;
  const data = my.data;

  const byId = new Map(data.spots.map((s) => [s.id, s]));
  // 新しい順（記録した日）
  const visits = [...data.visits].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <>
      <Header left={{ type: "back", href: "/me" }} title="行った場所" />
      <main className="screen has-tabbar content">
        {visits.length === 0 ? (
          <p className="sub" style={{ marginTop: 32, textAlign: "center" }}>行った場所を記録すると、おすすめがあなたに合っていきます。</p>
        ) : (
          visits.map((v) => {
            const s = byId.get(v.spotId);
            if (!s) return null;
            return (
              <Link key={v.spotId} href={`/spots/${s.id}`} className="card visit-row">
                <Photo src={s.photo} alt={s.name} label={s.area} className="" />
                <span className="wish-row-body" style={{ flex: 1 }}>
                  <span className="sub min">{prefectureShort(s.prefecture)}・{s.area}</span>
                  <b>{s.name}</b>
                  <span className="sub min">{fmt(v.createdAt)}</span>
                </span>
                {v.again === true && <Heart size={20} strokeWidth={2} aria-label="また行きたい" style={{ color: "var(--accent)" }} />}
              </Link>
            );
          })
        )}
      </main>
    </>
  );
}
