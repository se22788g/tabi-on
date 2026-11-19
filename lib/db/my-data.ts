"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import type { AnswerRowLite } from "@/lib/domain/tendency";
import type { Spot } from "@/lib/domain/spot";
import type { WishCandidate, WishRating } from "@/lib/domain/wishlist";
import { fetchAllSpots } from "./queries";
import { useSupabase } from "./use-supabase";

export type Visit = { spotId: string; again: boolean | null; createdAt: string };

/** マイページ（M5〜M7）と場所の詳細（M4）に使う、自分のデータ。どれも RLS で、自分の分だけ読める */
export type MyData = {
  userId: string;
  spots: Spot[];
  answers: AnswerRowLite[];
  ratings: WishRating[];
  candidates: WishCandidate[];
  visits: Visit[];
  displayName: string | null;
  /** 最後に使った出発地（都道府県名） */
  origin: string | null;
};

export async function loadMyData(client: SupabaseClient, userId: string): Promise<MyData> {
  const [spots, a, r, c, v, p] = await Promise.all([
    fetchAllSpots(client),
    client.from("answers").select("question_id, value"),
    client.from("ratings").select("candidate_id, level, created_at"),
    client.from("candidates").select("id, spot_ids"),
    client.from("visits").select("spot_id, again, created_at"),
    client.from("profiles").select("display_name, origin").maybeSingle(),
  ]);
  return {
    userId,
    spots,
    answers: (a.data ?? []).map((x) => ({ questionId: x.question_id as string, value: x.value })),
    ratings: (r.data ?? []).map((x) => ({ candidateId: x.candidate_id as string, level: x.level as number, createdAt: x.created_at as string })),
    candidates: (c.data ?? []).map((x) => ({ id: x.id as string, spotIds: x.spot_ids as string[] })),
    visits: (v.data ?? []).map((x) => ({ spotId: x.spot_id as string, again: x.again as boolean | null, createdAt: x.created_at as string })),
    displayName: p.data?.display_name ?? null,
    origin: p.data?.origin ?? null,
  };
}

export type MyDataState =
  | { status: "loading" }
  | { status: "unconfigured" | "failed" }
  | { status: "ready"; client: SupabaseClient; data: MyData; setVisits: (v: Visit[]) => void };

export function useMyData(): MyDataState {
  const sb = useSupabase();
  const [data, setData] = useState<MyData | null>(null);
  const client = sb.status === "ready" ? sb.client : null;
  const userId = sb.status === "ready" ? sb.userId : null;

  useEffect(() => {
    if (!client || !userId) return;
    let alive = true;
    loadMyData(client, userId).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [client, userId]);

  const setVisits = useCallback((visits: Visit[]) => setData((d) => (d ? { ...d, visits } : d)), []);

  if (sb.status === "unconfigured" || sb.status === "failed") return { status: sb.status };
  if (!client || !data) return { status: "loading" };
  return { status: "ready", client, data, setVisits };
}
