"use client";

import { BarChart3, Check, CheckCircle2, ChevronRight, Info, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AiBadge } from "@/components/ui/badges";
import { Header } from "@/components/layout/Header";
import { SecondaryButton } from "@/components/ui/buttons";
import { Photo } from "@/components/ui/Photo";
import { HOME_CARDS, WISH_ROWS, spotById } from "@/lib/mock/data";
import { sendToFriend } from "@/lib/share";

const HINT_KEY = "tabion:swipe-hint-seen";
// TODO(spec): 行きたい度合いがまだない人には、AiBadge なしでルールの「いまが見頃」3件を出す。段階4で分岐。
const SHOW_AI_BADGE = true;
const WISH_LIMIT = 10;

export function Me() {
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
    setIndex(Math.min(HOME_CARDS.length - 1, Math.max(0, i)));
    if (el.scrollLeft > 20 && showHint) {
      setShowHint(false);
      try {
        localStorage.setItem(HINT_KEY, "1");
      } catch {
        // 保存できなくても動く
      }
    }
  };

  const send = async (c: (typeof HOME_CARDS)[number]) => {
    const ok = await sendToFriend({ title: c.title, text: c.invite, url: `${window.location.origin}/spots/${c.spotId}` });
    if (ok) setSent(c.spotId);
  };

  const rows = showAll ? WISH_ROWS : WISH_ROWS.slice(0, WISH_LIMIT);

  return (
    <>
    <Header title="マイページ" />
    <main className="screen has-tabbar content">
      {/* 0. アカウント（一番上、小さめ） */}
      <section className="card" style={{ marginTop: 16, padding: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>わ</span>
          <b>わたし</b>
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
          {HOME_CARDS.map((c) => {
            const s = spotById(c.spotId)!;
            return (
              <article key={c.spotId} className="wish-card">
                <div className="wish-photo">
                  <Photo src={s.photo} alt={s.alt} label={s.area} className="" />
                  <span className="label">{c.label}</span>
                </div>
                <div className="wish-body">
                  <div>{SHOW_AI_BADGE && <AiBadge />}</div>
                  <span className="sub">{s.prefecture.replace(/[県府都]$/, "")}・{s.area}</span>
                  <h2>{c.title}</h2>
                  <p className="sub">{c.invite}</p>
                  <div className="wish-actions">
                    <button type="button" className="small-btn" onClick={() => send(c)}>
                      {sent === c.spotId ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Send size={16} strokeWidth={2} aria-hidden="true" />}
                      {sent === c.spotId ? "送りました" : "友だちに送る"}
                    </button>
                    <Link href={`/trips/new?seed=${c.spotId}`} className="small-btn fill">
                      ここへの旅をつくる
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="dots" aria-hidden="true">
          {HOME_CARDS.map((c, i) => (
            <i key={c.spotId} className={i === index ? "on" : ""} />
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
          rows.map((r) => {
            const s = spotById(r.spotId)!;
            return (
              <Link key={r.spotId} href={`/spots/${s.id}`} className="card wish-row">
                <Photo src={s.photo} alt={s.alt} label={s.area} className="" />
                <span className="wish-row-body">
                  <span className="sub min">{s.prefecture.replace(/[県府都]$/, "")}・{s.area}</span>
                  <b>{s.name}</b>
                  <span className="sub min">{r.detail}</span>
                  <span className="tags">
                    {r.tags.slice(0, 3).map((t) => (
                      <span key={t}>#{t}</span>
                    ))}
                  </span>
                </span>
                <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
              </Link>
            );
          })
        )}
        {WISH_ROWS.length > WISH_LIMIT && !showAll && (
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
