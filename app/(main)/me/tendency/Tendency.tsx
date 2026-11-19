"use client";

import { BarChart3, Heart, Map as MapIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { AiBadge, PrivacyNote } from "@/components/ui/badges";
import { Loading, SetupNotice } from "@/components/ui/Loading";
import { createHeadline, type HeadlineResult } from "@/lib/ai/tendency";
import { useMyData } from "@/lib/db/my-data";
import { computeTendency } from "@/lib/domain/tendency";
import type { Spot } from "@/lib/domain/spot";

const TONE = { strong: "tone-strong", often: "tone-often", normal: "tone-normal", light: "tone-light", rare: "tone-rare" } as const;

/** 「、」で区切って2行に収まる一文（例：温泉と雪景色に、心が動くみたい。→「温泉と雪景色に、」「心が動くみたい。」） */
function twoLines(text: string) {
  const i = text.indexOf("、");
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i + 1)}
      <br />
      {text.slice(i + 1)}
    </>
  );
}

export function Tendency() {
  const my = useMyData();
  const [headline, setHeadline] = useState<HeadlineResult | null>(null);
  const ready = my.status === "ready" ? my.data : null;

  const tendency = (() => {
    if (!ready) return null;
    const byId = new Map(ready.spots.map((s) => [s.id, s]));
    const liked = new Set<string>();
    for (const r of ready.ratings.filter((x) => x.level >= 3)) for (const id of ready.candidates.find((c) => c.id === r.candidateId)?.spotIds ?? []) liked.add(id);
    return computeTendency({ answers: ready.answers, ratingCount: ready.ratings.length, likedSpots: [...liked].map((id) => byId.get(id)).filter((s): s is Spot => Boolean(s)) });
  })();

  const traits = tendency?.topTraits.join("/") ?? "";
  useEffect(() => {
    if (!tendency) return;
    let alive = true;
    createHeadline({ topTraits: tendency.topTraits }).then((r) => alive && setHeadline(r));
    return () => {
      alive = false;
    };
    // topTraits の中身が変わったときだけ作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traits, tendency === null]);

  if (my.status === "unconfigured" || my.status === "failed") return <SetupNotice status={my.status} />;
  if (!tendency || !headline) return <Loading />;

  return (
    <>
      <Header left={{ type: "back", href: "/me" }} title="あなたの旅の傾向" />
      <main className="screen has-tabbar content">
        <section className="card" style={{ marginTop: 16, padding: 19 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <span className="icon-tile"><BarChart3 size={24} strokeWidth={2} aria-hidden="true" /></span>
            <div style={{ display: "grid", gap: 6 }}>
              {/* AiBadge は、AIが書いたひとことにだけ付ける。ルール版には付けない */}
              {headline.source === "ai" && <AiBadge />}
              {/* TODO(spec): 行きたい度合いが 3 以上の場所がまだないときのひとことは仕様書にない（仮の文言）。 */}
              <h1 style={{ fontSize: 21 }}>{headline.headline ? twoLines(headline.headline) : twoLines("これから、行きたい気持ちが、見えてきます。")}</h1>
              <p className="sub">これまでの{tendency.ratingCount}件の行きたい度合いから</p>
            </div>
          </div>
          <div className="legend">
            <span><i className="bg-rate rate-0" />ひかえめ</span>
            <span><i className="bg-rate rate-4" />強い気持ち</span>
          </div>
        </section>

        <section className="card" style={{ marginTop: 13, padding: 19 }}>
          <div className="row-between">
            <h2 style={{ fontSize: 18 }}>よく選ぶ「したいこと」</h2>
            <Heart size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          {tendency.wants.length === 0 ? (
            // TODO(spec): 「したいこと」の回答がまだないときの文言は仕様書にない（仮の文言）。
            <p className="sub" style={{ marginTop: 12 }}>質問に答えると、ここにたまっていきます。</p>
          ) : (
            <div className="trend-chips">
              {tendency.wants.map((w) => (
                <span key={w.label} className={TONE[w.tone]}>{w.label}</span>
              ))}
            </div>
          )}
        </section>

        <section className="card" style={{ marginTop: 13, padding: 19 }}>
          <div className="row-between">
            <h2 style={{ fontSize: 18 }}>旅の好み</h2>
            <MapIcon size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          {tendency.axes.map((b) => (
            <div className="pref" key={b.id}>
              <div className="pref-title">
                <h3 style={{ fontSize: 14 }}>{b.title}</h3>
                {b.word && <b>{b.word}</b>}
              </div>
              <div className="pref-labels">
                <span>{b.left}</span>
                <span>{b.right}</span>
              </div>
              {b.position !== null ? (
                <div className="pref-track"><i style={{ left: `${b.position * 100}%` }} /></div>
              ) : (
                <p className="sub" style={{ marginTop: 6 }}>あと{b.remaining}回答えると見えてきます</p>
              )}
            </div>
          ))}
        </section>

        <PrivacyNote>この傾向は、あなたにだけ表示されます</PrivacyNote>
      </main>
    </>
  );
}
