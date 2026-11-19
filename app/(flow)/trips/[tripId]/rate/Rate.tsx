"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { AiBadge, PartnerBadge } from "@/components/ui/badges";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { BottomBar, PrimaryButton, TextLink } from "@/components/ui/buttons";
import { RatingDots } from "@/components/ui/choices";
import { Photo } from "@/components/ui/Photo";
import { CANDIDATES, RATING_NAMES, spotById, type RatingLevel } from "@/lib/mock/data";

type Motion = "idle" | "left" | "right" | "up";
const motionOf = (l: RatingLevel): Motion => (l <= 1 ? "left" : l === 2 ? "up" : "right");

export function Rate({ tripId }: { tripId: string }) {
  // TODO(spec): 段階1は仮のおすすめ5件。段階3で、その人のために足したおすすめ→まだ選んでいない他のおすすめ（最大8枚）にする。
  const cards = CANDIDATES;
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<string, RatingLevel>>({});
  const [motion, setMotion] = useState<Motion>("idle");
  const [finished, setFinished] = useState(false);
  const [sheet, setSheet] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const card = cards[index];
  const selected = ratings[card.id] ?? null;
  const busy = motion !== "idle";

  const choose = (level: RatingLevel) => {
    if (busy) return;
    const next = { ...ratings, [card.id]: level };
    setRatings(next);
    setMotion(motionOf(level));
    window.setTimeout(() => {
      if (Object.keys(next).length === cards.length) {
        setFinished(true);
      } else {
        const after = cards.findIndex((c, i) => i > index && next[c.id] === undefined);
        setIndex(after >= 0 ? after : cards.findIndex((c) => next[c.id] === undefined));
      }
      setMotion("idle");
    }, 350);
  };

  // 弾く操作：右＝行きたい(3)、左＝あまり(1)、上＝どちらでもない(2)
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s || busy) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) choose(dx > 0 ? 3 : 1);
    else if (dy < -60 && Math.abs(dy) > Math.abs(dx)) choose(2);
  };

  if (finished) {
    return (
      <>
        <Header left={{ type: "back", onClick: () => setFinished(false) }} title="行きたい度合い" />
        <main className="screen has-action content">
          <div className="done-wrap">
            <span className="done-check">
              <Check size={40} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <h1>ぜんぶ選び終わりました</h1>
            <p className="lead">あなたの気持ちは、みんなの工程案に入ります。</p>
          </div>
        </main>
        <BottomBar>
          {/* TODO(spec): ここで工程案を作る処理（A2）を動かす。段階3以降。 */}
          <PrimaryButton href={`/trips/${tripId}/plan`}>旅の工程案を見る</PrimaryButton>
        </BottomBar>
      </>
    );
  }

  return (
    <>
      <Header left={{ type: "back", href: `/trips/${tripId}/intro` }} title="行きたい度合い" />
      <main className="screen content">
        <div className="candidate-nav" style={{ paddingTop: 8 }}>
          <button type="button" className="icon-btn" style={{ visibility: index === 0 ? "hidden" : "visible" }} aria-label="前のおすすめ" disabled={busy || index === 0} onClick={() => setIndex(index - 1)}>
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <span>
            {index + 1} / {cards.length}
          </span>
          <button type="button" className="icon-btn" style={{ visibility: index === cards.length - 1 ? "hidden" : "visible" }} aria-label="次のおすすめ" disabled={busy || index === cards.length - 1} onClick={() => setIndex(index + 1)}>
            <ChevronRight size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="candidate-stage">
          <article
            key={card.id}
            className={`candidate-card ${busy ? `card-exit-${motion}` : "card-enter"}`}
            onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
            onTouchEnd={onTouchEnd}
          >
            <div className={`heat-band ${selected !== null ? `bg-rate rate-${selected}` : ""}`} />
            <button type="button" className="photo-btn" onClick={() => setSheet(true)} aria-label={`${card.title}に含まれる場所を見る`}>
              <Photo src={spotById(card.spotIds[0])!.photo} alt={spotById(card.spotIds[0])!.alt} label={card.areaLabel} className="" />
            </button>
            <div className="candidate-body">
              <div className="row-between">
                <span className="sub">{card.areaLabel}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  <AiBadge />
                  {card.partner && <PartnerBadge />}
                </span>
              </div>
              <h2>{card.title}</h2>
              <div className="tags">
                {card.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </div>
              <div className="facts">
                <span>
                  {card.price} <small className="sub" style={{ fontWeight: 500 }}>/ ひとり</small>
                </span>
                <span>{card.time}</span>
              </div>
            </div>
          </article>
          {busy && selected !== null && (
            <span className={`choice-feedback rate-${selected}`} role="status">
              <Check size={16} strokeWidth={3} aria-hidden="true" />
              {RATING_NAMES[selected]}
            </span>
          )}
        </div>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, textAlign: "center" }}>ここに、どのくらい行きたい？</h2>
          <RatingDots value={selected} onChange={choose} disabled={busy} />
        </section>

        <div style={{ textAlign: "center", marginTop: 4 }}>
          <TextLink href={`/trips/${tripId}/plan`}>残りはとばして、工程案を見る</TextLink>
        </div>
      </main>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={`${card.title}の場所`}>
        <div className="stack" style={{ paddingBottom: 12 }}>
          {card.spotIds.map((id) => {
            const s = spotById(id)!;
            return (
              <div key={id} className="card" style={{ overflow: "hidden" }}>
                <Photo src={s.photo} alt={s.alt} label={s.name} className="" />
                <div style={{ padding: 14, display: "grid", gap: 6 }}>
                  <span className="sub">{s.prefecture}・{s.area}</span>
                  <h3>{s.name}</h3>
                  <p className="sub">{s.description}</p>
                  <Link href={`/spots/${s.id}`} className="small-btn" style={{ justifySelf: "start" }}>
                    詳しく見る
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
