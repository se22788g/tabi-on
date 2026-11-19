"use client";

import { Check, MapPin, Send, Share2 } from "lucide-react";
import { notFound } from "next/navigation";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PartnerBadge } from "@/components/ui/badges";
import { PrimaryButton } from "@/components/ui/buttons";
import { LevelDot } from "@/components/ui/choices";
import { Loading, SetupNotice } from "@/components/ui/Loading";
import { Photo } from "@/components/ui/Photo";
import { useMyData } from "@/lib/db/my-data";
import { prefectureShort } from "@/lib/domain/spot";
import { myLevelFor } from "@/lib/domain/wishlist";
import { RATING_NAMES } from "@/lib/domain/ratings";
import { sendToFriend } from "@/lib/share";

export function SpotDetail({ spotId }: { spotId: string }) {
  const my = useMyData();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = my.status === "ready" ? my : null;
  const spot = ready?.data.spots.find((s) => s.id === spotId) ?? null;
  const visit = ready?.data.visits.find((v) => v.spotId === spotId) ?? null;
  const visited = visit !== null;
  const level = ready ? myLevelFor(spotId, ready.data.ratings, ready.data.candidates) : null;

  /** 「行った」：押すと記録して「行った ✓」になる。もう一度押すと取り消す。TODO(spec): 取り消しの操作は仕様書にない。 */
  const toggleVisited = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const { client, data, setVisits } = ready;
    if (visited) {
      await client.from("visits").delete().eq("user_id", data.userId).eq("spot_id", spotId);
      setVisits(data.visits.filter((v) => v.spotId !== spotId));
    } else {
      await client.from("visits").upsert({ user_id: data.userId, spot_id: spotId }, { onConflict: "user_id,spot_id", ignoreDuplicates: true });
      setVisits([...data.visits, { spotId, again: null, createdAt: new Date().toISOString() }]);
    }
    setBusy(false);
  };
  /** 「また行きたい／一度でいい」 */
  const setAgain = async (again: boolean) => {
    if (!ready) return;
    await ready.client.from("visits").update({ again }).eq("user_id", ready.data.userId).eq("spot_id", spotId);
    ready.setVisits(ready.data.visits.map((v) => (v.spotId === spotId ? { ...v, again } : v)));
  };

  if (my.status === "unconfigured" || my.status === "failed") return <SetupNotice status={my.status} />;
  if (!ready) return <Loading />;
  if (!spot) notFound();
  const again = visit?.again ?? null;
  const share = async () => {
    const ok = await sendToFriend({ title: spot.name, text: `${spot.prefecture}・${spot.area}`, url: window.location.href });
    if (ok) setSent(true);
  };
  const hours = Math.floor(spot.durationMin / 60);
  const mins = spot.durationMin % 60;
  const duration = hours ? `約${hours}時間${mins ? `${mins}分` : ""}` : `約${mins}分`;

  return (
    <>
      <Header
        left={{ type: "back" }}
        title={spot.name}
        right={
          <button type="button" className="icon-btn" aria-label="共有" onClick={share}>
            <Share2 size={20} strokeWidth={2} />
          </button>
        }
      />
      <main className="screen has-tabbar content">
        {/* 写真は横にスワイプして1〜3枚。撮影者名があれば、写真の下に小さく出す */}
        <div className={`spot-hero ${spot.images.length > 1 ? "spot-swipe" : ""}`} style={{ marginTop: 16 }}>
          {(spot.images.length ? spot.images : [{ url: "", credit: "" }]).map((img, i) => (
            <Photo key={i} src={img.url || null} alt={spot.name} label={spot.name} className="" />
          ))}
        </div>
        {spot.credit && <p className="sub min" style={{ marginTop: 6 }}>Photo: {spot.credit} / Unsplash</p>}
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <span className="sub">{prefectureShort(spot.prefecture)}・{spot.area}</span>
          <h1 style={{ fontSize: 24 }}>{spot.name}</h1>
          <div className="tags">
            {spot.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
          {spot.isPartner && <div><PartnerBadge /></div>}
          <p>{spot.description}</p>
        </div>

        {level !== null && (
          <p className="card" style={{ marginTop: 16, padding: 14, display: "flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
            <LevelDot level={level} size={18} />
            あなたの行きたい度合い：{RATING_NAMES[level]}
          </p>
        )}

        <dl className="info-table card" style={{ marginTop: 16, padding: 16 }}>
          <dt>住所</dt><dd>{spot.address}</dd>
          <dt>営業時間</dt><dd>{spot.hours}</dd>
          <dt>料金の目安</dt><dd>約{spot.priceYen.toLocaleString()}円 / ひとり</dd>
          <dt>所要時間</dt><dd>{duration}</dd>
          <dt>アクセス</dt><dd>{spot.access}</dd>
          <dt>予約</dt><dd>{spot.isPartner ? "予約できる体験あり（デモのため押せません）" : "予約はありません"}</dd>
        </dl>

        <div className="stack" style={{ marginTop: 16 }}>
          <a
            className="secondary-btn"
            href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin size={18} strokeWidth={2} aria-hidden="true" />
            地図で見る
          </a>
          <button type="button" className="secondary-btn" aria-pressed={visited} disabled={busy} onClick={toggleVisited}>
            {visited ? "行った ✓" : "行った"}
          </button>
          {visited && (
            <div className="card" style={{ padding: 14 }}>
              <p style={{ fontWeight: 900, marginBottom: 8 }}>また行きたい？</p>
              <div className="chips">
                <button type="button" className="chip" aria-pressed={again === true} onClick={() => void setAgain(true)}>
                  また行きたい
                </button>
                <button type="button" className="chip" aria-pressed={again === false} onClick={() => void setAgain(false)}>
                  一度でいい
                </button>
              </div>
            </div>
          )}
          <button type="button" className="secondary-btn" onClick={share}>
            {sent ? <Check size={18} strokeWidth={2} aria-hidden="true" /> : <Send size={18} strokeWidth={2} aria-hidden="true" />}
            {sent ? "送りました" : "友だちに送る"}
          </button>
        </div>
        <p className="sub min" style={{ marginTop: 20, textAlign: "center" }}>この場所の情報は、試作用の架空のものです。</p>
        {/* TODO(spec): M4 は下がタブバーのため、メインボタンは本文の末尾に置いた。 */}
        <div style={{ marginTop: 20 }}>
          <PrimaryButton href={`/trips/new?seed=${spot.id}`}>ここへの旅をつくる</PrimaryButton>
        </div>
      </main>
    </>
  );
}
