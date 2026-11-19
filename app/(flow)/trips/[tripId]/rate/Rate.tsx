"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { AiBadge, PartnerBadge } from "@/components/ui/badges";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { BottomBar, PrimaryButton, TextLink } from "@/components/ui/buttons";
import { RatingDots } from "@/components/ui/choices";
import { Photo } from "@/components/ui/Photo";
import { Loading, SetupNotice } from "@/components/ui/Loading";
import { fetchAllSpots, fetchTrip } from "@/lib/db/queries";
import { useSupabase } from "@/lib/db/use-supabase";
import type { Spot } from "@/lib/domain/spot";
import { candidatePriceYen, nearestOrigin, travelTimeLabel, type OriginCity } from "@/lib/domain/travel";
import { RATING_NAMES, type RatingLevel } from "@/lib/domain/ratings";
import { generatePlanAction } from "@/lib/server/trip-actions";

/** F6 に出すおすすめの最大枚数 */
const MAX_CARDS = 8;

type Card = {
  id: string;
  areaLabel: string;
  title: string;
  tags: string[];
  price: string;
  time: string;
  spotIds: string[];
  partner: boolean;
  ai: boolean;
  forMe: boolean;
};

type Motion = "idle" | "left" | "right" | "up";
const motionOf = (l: RatingLevel): Motion => (l <= 1 ? "left" : l === 2 ? "up" : "right");

export function Rate({ tripId }: { tripId: string }) {
  const router = useRouter();
  const sb = useSupabase();
  const client = sb.status === "ready" ? sb.client : null;
  const userId = sb.status === "ready" ? sb.userId : null;
  const [cards, setCards] = useState<Card[] | null>(null);
  const [spots, setSpots] = useState<Map<string, Spot>>(new Map());
  const [memberId, setMemberId] = useState("");
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<string, RatingLevel>>({});
  const [motion, setMotion] = useState<Motion>("idle");
  const [finished, setFinished] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sheet, setSheet] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const finishing = useRef<Promise<void> | null>(null);
  /** 度合いの保存は順番に行い、工程案を作る前に、すべて保存し終える */
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!client) return;
    let alive = true;
    (async () => {
      const r = await fetchTrip(client, tripId);
      const me = r?.members.find((m) => m.userId === userId);
      if (!r || !me) return router.replace("/trips");
      const [{ data: cs }, { data: rs }, allSpots] = await Promise.all([
        client.from("candidates").select("id, title, area_label, spot_ids, tags, source, for_member_id, created_at").eq("trip_id", tripId).order("created_at").order("id"),
        client.from("ratings").select("candidate_id, level").eq("member_id", me.id),
        fetchAllSpots(client),
      ]);
      if (!alive) return;
      const byId = new Map(allSpots.map((s) => [s.id, s]));
      const mine = Object.fromEntries((rs ?? []).map((x) => [x.candidate_id as string, x.level as RatingLevel]));
      // その人が選ぶ順番：その人のために足したおすすめ → まだ選んでいない他のおすすめ。最大8枚
      const all = cs ?? [];
      const picked = [...all.filter((c) => c.for_member_id === me.id), ...all.filter((c) => c.for_member_id !== me.id && mine[c.id] === undefined)].slice(0, MAX_CARDS);
      const origin: OriginCity | null = r.trip.origin ? nearestOrigin(r.trip.origin) : null;
      const list: Card[] = picked.map((c) => {
        const ids = c.spot_ids as string[];
        const ss = ids.map((id) => byId.get(id)).filter((x): x is Spot => Boolean(x));
        return {
          id: c.id,
          areaLabel: c.area_label,
          title: c.title,
          tags: c.tags,
          price: `約${candidatePriceYen({ origin, spots: ss.map((x) => ({ id: x.id, category: x.category, priceYen: x.priceYen })), nights: r.trip.nights }).toLocaleString("ja-JP")}円`,
          time: travelTimeLabel(origin, ids[0]),
          spotIds: ids,
          partner: ss.some((x) => x.isPartner),
          ai: c.source === "ai",
          forMe: c.for_member_id === me.id,
        };
      });
      setSpots(byId);
      setMemberId(me.id);
      setRatings(mine);
      setIndex(Math.max(0, list.findIndex((c) => mine[c.id] === undefined)));
      setCards(list);
      if (list.length === 0 || list.every((c) => mine[c.id] !== undefined)) setFinished(true);
    })();
    return () => {
      alive = false;
    };
  }, [client, userId, tripId, router]);

  // 全部選んだら（またはとばしたら）、行きたい度合いを終えた時刻を入れて、工程案を作る処理（A2）を動かす。1回だけ。
  const finish = () => {
    if (!client || !memberId) return Promise.resolve();
    finishing.current ??= (async () => {
      await writes.current;
      await client.from("members").update({ rated_at: new Date().toISOString() }).eq("id", memberId);
      await generatePlanAction(tripId);
      setPlanReady(true);
    })();
    return finishing.current;
  };
  useEffect(() => {
    if (finished) void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, memberId, client]);

  const skipToPlan = async () => {
    if (leaving) return;
    setLeaving(true);
    await finish();
    router.push(`/trips/${tripId}/plan`);
  };

  if (sb.status === "unconfigured" || sb.status === "failed") return <SetupNotice status={sb.status} />;
  if (!cards) return <Loading />;
  const card = cards[index];
  const selected = card ? ratings[card.id] ?? null : null;
  const busy = motion !== "idle";

  const choose = (level: RatingLevel) => {
    if (busy) return;
    const next = { ...ratings, [card.id]: level };
    setRatings(next);
    writes.current = writes.current
      .then(() => client?.from("ratings").upsert({ member_id: memberId, candidate_id: card.id, level }, { onConflict: "member_id,candidate_id" }))
      .catch((e) => console.error("ratings", e));
    setMotion(motionOf(level));
    window.setTimeout(() => {
      if (cards.every((c) => next[c.id] !== undefined)) {
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
          <PrimaryButton disabled={!planReady || leaving} href={`/trips/${tripId}/plan`}>
            旅の工程案を見る
          </PrimaryButton>
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
              <Photo src={spots.get(card.spotIds[0])?.photo ?? null} alt={card.areaLabel} label={card.areaLabel} className="" />
            </button>
            <div className="candidate-body">
              <div className="row-between">
                <span className="sub">{card.areaLabel}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  {card.ai && <AiBadge />}
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
          <TextLink onClick={skipToPlan}>残りはとばして、工程案を見る</TextLink>
        </div>
      </main>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={`${card.title}の場所`}>
        <div className="stack" style={{ paddingBottom: 12 }}>
          {card.spotIds.map((id) => {
            const s = spots.get(id);
            if (!s) return null;
            return (
              <div key={id} className="card" style={{ overflow: "hidden" }}>
                <Photo src={s.photo} alt={s.name} label={s.name} className="" />
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
