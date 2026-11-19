import { Heart } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Photo } from "@/components/ui/Photo";
import { VISITED, spotById } from "@/lib/mock/data";

export default function Page() {
  return (
    <>
      <Header left={{ type: "back", href: "/me" }} title="行った場所" />
      <main className="screen has-tabbar content">
        {VISITED.length === 0 ? (
          <p className="sub" style={{ marginTop: 32, textAlign: "center" }}>行った場所を記録すると、おすすめがあなたに合っていきます。</p>
        ) : (
          VISITED.map((v) => {
            const s = spotById(v.spotId)!;
            return (
              <Link key={v.spotId} href={`/spots/${s.id}`} className="card visit-row">
                <Photo src={s.photo} alt={s.alt} label={s.area} className="" />
                <span className="wish-row-body" style={{ flex: 1 }}>
                  <span className="sub min">{s.prefecture.replace(/[県府都]$/, "")}・{s.area}</span>
                  <b>{s.name}</b>
                  <span className="sub min">{v.date}</span>
                </span>
                {v.again && <Heart size={20} strokeWidth={2} aria-label="また行きたい" style={{ color: "var(--accent)" }} />}
              </Link>
            );
          })
        )}
      </main>
    </>
  );
}
