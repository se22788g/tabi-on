"use client";

import { Check, MapPin, Send, Share2 } from "lucide-react";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PartnerBadge } from "@/components/ui/badges";
import { PrimaryButton } from "@/components/ui/buttons";
import { LevelDot } from "@/components/ui/choices";
import { Photo } from "@/components/ui/Photo";
import { RATING_NAMES, type MockSpot } from "@/lib/mock/data";
import { sendToFriend } from "@/lib/share";

// TODO(spec): 自分が選んだ行きたい度合いは、段階4でDBから読む。段階1は銀山温泉だけ仮に「すごく行きたい」を出す。
const MY_LEVEL: Record<string, number> = { "yamagata-ginzan-yukimi-buro": 4 };

export function SpotDetail({ spot }: { spot: MockSpot }) {
  const [visited, setVisited] = useState(false);
  const [again, setAgain] = useState<boolean | null>(null);
  const [sent, setSent] = useState(false);
  const level = MY_LEVEL[spot.id];
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
        <div className="spot-hero" style={{ marginTop: 16 }}>
          <Photo src={spot.photo} alt={spot.alt} label={spot.name} className="" />
        </div>
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <span className="sub">{spot.prefecture}・{spot.area}</span>
          <h1 style={{ fontSize: 24 }}>{spot.name}</h1>
          <div className="tags">
            {spot.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
          {spot.isPartner && <div><PartnerBadge /></div>}
          <p>{spot.description}</p>
        </div>

        {level !== undefined && (
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
          <button type="button" className="secondary-btn" aria-pressed={visited} onClick={() => setVisited(!visited)}>
            {visited ? "行った ✓" : "行った"}
          </button>
          {visited && (
            <div className="card" style={{ padding: 14 }}>
              <p style={{ fontWeight: 900, marginBottom: 8 }}>また行きたい？</p>
              <div className="chips">
                <button type="button" className="chip" aria-pressed={again === true} onClick={() => setAgain(true)}>
                  また行きたい
                </button>
                <button type="button" className="chip" aria-pressed={again === false} onClick={() => setAgain(false)}>
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
        {/* TODO(spec): 「行った」の保存（visits）と、取り消しの操作は段階4。 */}
        <p className="sub min" style={{ marginTop: 20, textAlign: "center" }}>この場所の情報は、試作用の架空のものです。</p>
        {/* TODO(spec): M4 は下がタブバーのため、メインボタンは本文の末尾に置いた。 */}
        <div style={{ marginTop: 20 }}>
          <PrimaryButton href={`/trips/new?seed=${spot.id}`}>ここへの旅をつくる</PrimaryButton>
        </div>
      </main>
    </>
  );
}
