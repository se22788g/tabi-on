"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { AiBadge } from "@/components/ui/badges";
import { PrimaryButton, TextLink } from "@/components/ui/buttons";
import { SetupNotice } from "@/components/ui/Loading";
import { fetchTrip } from "@/lib/db/queries";
import { useSupabase } from "@/lib/db/use-supabase";
import { visibleQuestions } from "@/lib/domain/questions";
import { RATING_NAMES } from "@/lib/mock/data";
import { generateCandidatesAction, generatePlanAction } from "@/lib/server/trip-actions";

/** おすすめを作っている間の、波の動きを最低これだけ見せる（短すぎると、何が起きたか分からないため） */
const MIN_WAIT_MS = 1200;

export function Intro({ tripId }: { tripId: string }) {
  const router = useRouter();
  const sb = useSupabase();
  const [loading, setLoading] = useState(true);
  const [lastStep, setLastStep] = useState(12);
  const [ai, setAi] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const started = useRef(false);
  const client = sb.status === "ready" ? sb.client : null;
  const userId = sb.status === "ready" ? sb.userId : null;

  // この画面を開くと同時に、おすすめを作る処理（A1）を始める。同じ人が何度開いても、おすすめは1回しか足さない
  useEffect(() => {
    if (!client || started.current) return;
    started.current = true;
    (async () => {
      const t0 = Date.now();
      const r = await fetchTrip(client, tripId);
      const me = r?.members.find((m) => m.userId === userId);
      if (!r || !me) return router.replace("/trips");
      setLastStep(visibleQuestions(r.trip).length);
      await generateCandidatesAction(tripId);
      // AIが作ったおすすめにだけ「あなたへのおすすめ」の印を付ける（ルール版には付けない）
      const { data } = await client.from("candidates").select("source").eq("trip_id", tripId).eq("for_member_id", me.id);
      setAi((data ?? []).some((c) => c.source === "ai"));
      window.setTimeout(() => setLoading(false), Math.max(0, MIN_WAIT_MS - (Date.now() - t0)));
    })();
  }, [client, userId, tripId, router]);

  // 「とばして、旅の工程案を見る」：行きたい度合いを選ばずに終えた扱いにして、工程案を作ってから開く
  const skipToPlan = async () => {
    if (!client || skipping) return;
    setSkipping(true);
    const { data: auth } = await client.auth.getUser();
    await client.from("members").update({ rated_at: new Date().toISOString() }).eq("trip_id", tripId).eq("user_id", auth.user?.id ?? "");
    await generatePlanAction(tripId);
    router.push(`/trips/${tripId}/plan`);
  };

  if (sb.status === "unconfigured" || sb.status === "failed") return <SetupNotice status={sb.status} />;

  return (
    <>
      <Header left={{ type: "back", href: `/trips/${tripId}/q/${lastStep}` }} title="あなたへのおすすめ" />
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
              {ai && <AiBadge />}
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
          <PrimaryButton href={`/trips/${tripId}/rate`} disabled={loading || skipping}>
            はじめる
          </PrimaryButton>
          <TextLink onClick={skipToPlan}>とばして、旅の工程案を見る</TextLink>
        </div>
      </main>
    </>
  );
}
