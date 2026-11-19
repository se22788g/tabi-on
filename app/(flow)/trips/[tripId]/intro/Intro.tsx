"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { AiBadge } from "@/components/ui/badges";
import { PrimaryButton, TextLink } from "@/components/ui/buttons";
import { visibleQuestions } from "@/lib/domain/questions";
import { MOCK_CONDITIONS, RATING_NAMES } from "@/lib/mock/data";

const LAST_STEP = visibleQuestions(MOCK_CONDITIONS).length;

export function Intro({ tripId }: { tripId: string }) {
  // TODO(spec): 段階1では「おすすめを作る」を待つ動きを時間で真似ている。段階3以降で A1（ルール版→AI）につなぐ。
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 1800);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      <Header left={{ type: "back", href: `/trips/${tripId}/q/${LAST_STEP}` }} title="あなたへのおすすめ" />
      <main className="screen content" style={{ paddingBottom: "calc(32px + var(--safe-bottom))" }}>
        <div className="guide-center">
          {loading ? (
            <div role="status">
              <div className="wave" aria-hidden="true" style={{ justifyContent: "center" }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <i key={i} className={`bg-rate rate-${i}`} style={{ ["--i" as string]: i } as React.CSSProperties} />
                ))}
              </div>
              <p style={{ marginTop: 20, fontWeight: 900 }}>あなたの回答から、おすすめを作っています</p>
            </div>
          ) : (
            <>
              <AiBadge />
              <h1 style={{ marginTop: 16 }}>行きたい気持ちを、ひとつずつ選ぼう</h1>
              <p className="lead">選ぶと次の候補に進みます。みんなの気持ちから工程案ができます。</p>
              {/* TODO(spec): 「次の画面で、こんなふうに選びます」は文言一覧にない（F5 の仕様の本文にある）。 */}
              <p className="sub min" style={{ marginTop: 28 }}>次の画面で、こんなふうに選びます</p>
              <div className="rate-sample" aria-hidden="true">
                {RATING_NAMES.map((name, i) => (
                  <span key={name}>
                    <i className={`bg-rate rate-${i}`} />
                    {name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        {/* 画面下に固定せず、見本のすぐ下（余白24px）に置く */}
        <div className="stack" style={{ marginTop: 24 }}>
          <PrimaryButton href={`/trips/${tripId}/rate`} disabled={loading}>
            はじめる
          </PrimaryButton>
          <TextLink href={`/trips/${tripId}/plan`}>とばして、旅の工程案を見る</TextLink>
        </div>
      </main>
    </>
  );
}
