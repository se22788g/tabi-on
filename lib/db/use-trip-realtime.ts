"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { debounced } from "./debounce";

/** この旅の、どのテーブルの変更を受け取るか。ratings・answers・candidates は、届けない（ほかの人の度合いを通知で流さない） */
export type RealtimeTable = "plans" | "plan_items" | "members";

const DEBOUNCE_MS = 300;

/**
 * Supabase Realtime で、その旅の変更を受け取って、onChange を呼ぶ（続けて届いたら、1回にまとめる）。
 * 通知は RLS を通して、その旅のメンバーにだけ届く。通知の中身は使わず、onChange の中で読み直す。
 */
export function useTripRealtime(client: SupabaseClient | null, tripId: string, tables: RealtimeTable[], onChange: () => void): void {
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = tables.join(",");

  useEffect(() => {
    if (!client) return;
    const d = debounced(() => cb.current(), DEBOUNCE_MS);
    let channel = client.channel(`trip-${tripId}`);
    for (const table of key.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `trip_id=eq.${tripId}` }, () => d.call());
    }
    channel.subscribe();
    return () => {
      d.cancel();
      void client.removeChannel(channel);
    };
  }, [client, tripId, key]);
}
