"use client";

import { BarChart3, Check, CheckCircle2, ChevronRight, Info, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AiBadge } from "@/components/ui/badges";
import { Header } from "@/components/layout/Header";
import { SecondaryButton } from "@/components/ui/buttons";
import { Photo } from "@/components/ui/Photo";
import { Loading, SetupNotice } from "@/components/ui/Loading";
import { createHome } from "@/lib/ai/home";
import type { HomeItem } from "@/lib/ai/fallback/home";
import { useMyData } from "@/lib/db/my-data";
import { computeTendency } from "@/lib/domain/tendency";
import { prefectureShort, type Spot } from "@/lib/domain/spot";
import { areaKeyOf, nearestOrigin, travelFor, travelTimeLabel } from "@/lib/domain/travel";
import { buildWishlist, stayAdvice, WISH_PAGE } from "@/lib/domain/wishlist";
import { sendToFriend } from "@/lib/share";

const HINT_KEY = "tabion:swipe-hint-seen";

export function Me() {
  const my = useMyData();
  const [home, setHome] = useState<{ source: "ai" | "rule"; items: HomeItem[] } | null>(null);
  const ready = my.status === "ready" ? my.data : null;

  // 今の月（ブラウザの日付）で、おすすめを作る。行った場所と「まだ行けていない場所」は選ばない
  useEffect(() => {
    if (!ready) return;
    const wish = buildWishlist({ ratings: ready.ratings, candidates: ready.candidates, visitedSpotIds: ready.visits.map((v) => v.spotId) });
    const byId = new Map(ready.spots.map((s) => [s.id, s]));
    const liked = new Set<string>();
    for (const r of ready.ratings.filter((x) => x.level >= 3)) for (const id of ready.candidates.find((c) => c.id === r.candidateId)?.spotIds ?? []) liked.add(id);
    const t = computeTendency({ answers: ready.answers, ratingCount: ready.ratings.length, likedSpots: [...liked].map((id) => byId.get(id)).filter((s): s is Spot => Boolean(s)) });
    let alive = true;
    createHome({
      month: new Date().getMonth() + 1,
      spots: ready.spots,
      excludeIds: [...ready.visits.map((v) => v.spotId), ...wish],
      // まだ行きたい度合いがない人は、傾向なしで「いまが見頃」だけを選ぶ
      topTraits: ready.ratings.length > 0 ? t.topTraits : [],
    }).then((r) => alive && setHome(r));
    return () => {
      alive = false;
    };
  }, [ready]);
  const [index, setIndex] = useState(0);
  const [sent, setSent] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(HINT_KEY)) setShowHint(true);
    } catch {
      setShowHint(true);
    }
  }, []);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    if (!card) return;
    const i = Math.round(el.scrollLeft / (card.offsetWidth + 13));
    setIndex(Math.min(2, Math.max(0, i)));
    if (el.scrollLeft > 20 && showHint) {
      setShowHint(false);
      try {
        localStorage.setItem(HINT_KEY, "1");
      } catch {
        // 保存できなくても動く
      }
    }
  };

  const send = async (c: HomeItem) => {
    const ok = await sendToFriend({ title: c.title, text: c.invite, url: `${window.location.origin}/spots/${c.spot_id}` });
    if (ok) setSent(c.spot_id);
  };

  if (my.status === "unconfigured" || my.status === "failed") return <SetupNotice status={my.status} />;
  if (!ready || !home) return <Loading />;

  const byId = new Map(ready.spots.map((s) => [s.id, s]));
  const cards = home.items;
  const origin = ready.origin ? nearestOrigin(ready.origin) : null;
  const wishIds = buildWishlist({ ratings: ready.ratings, candidates: ready.candidates, visitedSpotIds: ready.visits.map((v) => v.spotId) });
  const rows = (showAll ? wishIds : wishIds.slice(0, WISH_PAGE)).map((id) => byId.get(id)).filter((s): s is Spot => Boolean(s));
  const detailOf = (s: Spot) => {
    const area = areaKeyOf(s.id);
    return `${travelTimeLabel(origin, s.id)}・${stayAdvice(area ? travelFor(origin ?? "東京", area).minutes : 0)}`;
  };

  return (
    <>
    <Header title="マイページ" />
    <main className="screen has-tabbar content">
      {/* 0. アカウント（一番上、小さめ） */}
      <section className="card" style={{ marginTop: 16, padding: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>{(ready.displayName ?? "わたし").slice(0, 1)}</span>
          <b>{ready.displayName ?? "わたし"}</b>
        </div>
        {/* TODO(spec): アカウントの有無で切り替える（あればメールアドレスと「ログアウト」）。Googleとメールでの登録は段階6。 */}
        <p className="sub min">アカウントを作ると、ほかの端末でも記録が見られます</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <SecondaryButton>Googleで続ける</SecondaryButton>
          <SecondaryButton>メールで続ける</SecondaryButton>
        </div>
      </section>

      <section style={{ paddingTop: 22 }}>
        <h1>次は、誰とどこへ行こう。</h1>
        <p className="lead">ひとりで考えはじめても大丈夫。工程案ができたら、誰かを誘えます。</p>
        <div className="carousel" ref={ref} onScroll={onScroll} aria-label="おすすめの行き先">
          {cards.map((c) => {
            const s = byId.get(c.spot_id);
            if (!s) return null;
            return (
              <article key={c.spot_id} className="wish-card">
                <div className="wish-photo">
                  <Photo src={s.photo} alt={s.name} label={s.area} className="" />
                  <span className="label">{c.label}</span>
                </div>
                <div className="wish-body">
                  {/* AiBadge は、AIが作ったおすすめにだけ付ける。ルール版（いまは常にルール版）には付けない */}
                  <div>{home.source === "ai" && <AiBadge />}</div>
                  <span className="sub">{prefectureShort(s.prefecture)}・{s.area}</span>
                  <h2>{c.title}</h2>
                  <p className="sub">{c.invite}</p>
                  <div className="wish-actions">
                    <button type="button" className="small-btn" onClick={() => send(c)}>
                      {sent === c.spot_id ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Send size={16} strokeWidth={2} aria-hidden="true" />}
                      {sent === c.spot_id ? "送りました" : "友だちに送る"}
                    </button>
                    <Link href={`/trips/new?seed=${c.spot_id}`} className="small-btn fill">
                      ここへの旅をつくる
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="dots" aria-hidden="true">
          {cards.map((c, i) => (
            <i key={c.spot_id} className={i === index ? "on" : ""} />
          ))}
        </div>
        {showHint && (
          <p className="sub min" style={{ textAlign: "center", marginTop: 6 }}>
            横にスワイプして見る
          </p>
        )}
      </section>

      <section className="section-title">
        <h2>まだ行けていない場所</h2>
        <p className="lead">あなたが「行きたい」以上を選んだ場所です。</p>
        {rows.length === 0 ? (
          <p className="sub" style={{ marginTop: 12 }}>行きたい度合いを選ぶと、ここにたまっていきます。</p>
        ) : (
          rows.map((s) => (
            <Link key={s.id} href={`/spots/${s.id}`} className="card wish-row">
              <Photo src={s.photo} alt={s.name} label={s.area} className="" />
              <span className="wish-row-body">
                <span className="sub min">{prefectureShort(s.prefecture)}・{s.area}</span>
                <b>{s.name}</b>
                <span className="sub min">{detailOf(s)}</span>
                <span className="tags">
                  {s.tags.slice(0, 3).map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </span>
              </span>
              <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
            </Link>
          ))
        )}
        {wishIds.length > WISH_PAGE && !showAll && (
          <button type="button" className="small-btn" style={{ marginTop: 12 }} onClick={() => setShowAll(true)}>
            もっと見る
          </button>
        )}
      </section>

      {/* 3. あなたの旅の傾向 */}
      <Link href="/me/tendency" className="card link-card">
        <span className="icon-tile">
          <BarChart3 size={22} strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="grow">
          <b>あなたの旅の傾向</b>
          <span className="sub min">これまでの「行きたい」から分かること</span>
        </span>
        <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
      </Link>

      {/* 4. 一覧 */}
      <div className="stack" style={{ marginTop: 16, paddingBottom: 8 }}>
        <Link href="/me/visited" className="card link-card" style={{ marginTop: 0 }}>
          <span className="icon-tile"><CheckCircle2 size={22} strokeWidth={2} aria-hidden="true" /></span>
          <b className="grow">行った場所</b>
          <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
        </Link>
        <details className="card" style={{ padding: 12 }}>
          <summary className="link-card" style={{ margin: 0, padding: 0, minHeight: 56, cursor: "pointer", listStyle: "none" }}>
            <span className="icon-tile"><Info size={22} strokeWidth={2} aria-hidden="true" /></span>
            <b className="grow">このアプリについて</b>
          </summary>
          <p className="sub" style={{ padding: "8px 4px 4px" }}>
            たびおんは、試作のアプリです。載っている場所や体験は、実際にありそうな内容で作った架空のものです。予約はできません。
          </p>
        </details>
      </div>
    </main>
    </>
  );
}
