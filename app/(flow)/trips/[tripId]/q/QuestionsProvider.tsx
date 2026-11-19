"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loading, SetupNotice } from "@/components/ui/Loading";
import { fetchAllSpots, fetchTrip, type TripInfo } from "@/lib/db/queries";
import { useSupabase } from "@/lib/db/use-supabase";
import type { Spot } from "@/lib/domain/spot";
import { useRouter } from "next/navigation";

export type AnswerValue = string[] | number | null;
type Ctx = {
  trip: TripInfo;
  memberCount: number;
  memberId: string;
  /** 自分が旅の言い出し役か */
  isOwner: boolean;
  spots: Spot[];
  answers: Record<string, AnswerValue>;
  /** 回答をその都度保存する。空（未選択）なら行を消す（とばした問いは行を作らない） */
  set: (id: string, v: AnswerValue) => void;
  /** 最後の問いのあと：質問を終えた時刻を入れる */
  finish: () => Promise<void>;
};

const QuestionsContext = createContext<Ctx | null>(null);

const isEmpty = (v: AnswerValue) => v === null || (Array.isArray(v) && v.length === 0);

async function save(client: SupabaseClient, memberId: string, questionId: string, v: AnswerValue) {
  if (isEmpty(v)) await client.from("answers").delete().eq("member_id", memberId).eq("question_id", questionId);
  else await client.from("answers").upsert({ member_id: memberId, question_id: questionId, value: v }, { onConflict: "member_id,question_id" });
}

/** 質問の画面をまたいで、旅の条件と自分の回答を持つ。戻っても、閉じて開き直しても、回答は消えない */
export function QuestionsProvider({ tripId, children }: { tripId: string; children: ReactNode }) {
  const router = useRouter();
  const sb = useSupabase();
  const [ready, setReady] = useState<Omit<Ctx, "set" | "finish" | "answers"> & { initial: Record<string, AnswerValue> } | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const client = sb.status === "ready" ? sb.client : null;
  const userId = sb.status === "ready" ? sb.userId : null;

  useEffect(() => {
    if (!client) return;
    let alive = true;
    (async () => {
      const r = await fetchTrip(client, tripId);
      const me = r?.members.find((m) => m.userId === userId);
      if (!r || !me) return router.replace("/trips");
      const [{ data: rows }, spots] = await Promise.all([
        client.from("answers").select("question_id, value").eq("member_id", me.id),
        fetchAllSpots(client),
      ]);
      if (!alive) return;
      const initial = Object.fromEntries((rows ?? []).map((a) => [a.question_id as string, a.value as AnswerValue]));
      setAnswers(initial);
      setReady({ trip: r.trip, memberCount: r.members.length, memberId: me.id, isOwner: me.isOwner, spots, initial });
    })();
    return () => {
      alive = false;
    };
  }, [client, tripId, userId, router]);

  const set = useCallback(
    (id: string, v: AnswerValue) => {
      setAnswers((a) => ({ ...a, [id]: v }));
      if (client && ready) {
        // 保存は順番に行う（早く押しても、最後に選んだものが残る）
        queue.current = queue.current.then(() => save(client, ready.memberId, id, v)).catch((e) => console.error("answers", e));
      }
    },
    [client, ready],
  );

  const finish = useCallback(async () => {
    if (!client || !ready) return;
    await queue.current;
    await client.from("members").update({ answered_at: new Date().toISOString() }).eq("id", ready.memberId);
  }, [client, ready]);

  const value = useMemo<Ctx | null>(() => (ready ? { ...ready, answers, set, finish } : null), [ready, answers, set, finish]);

  if (sb.status === "unconfigured" || sb.status === "failed") return <SetupNotice status={sb.status} />;
  if (!value) return <Loading />;
  return <QuestionsContext.Provider value={value}>{children}</QuestionsContext.Provider>;
}

export function useQuestions(): Ctx {
  const ctx = useContext(QuestionsContext);
  if (!ctx) throw new Error("QuestionsProvider がありません");
  return ctx;
}
