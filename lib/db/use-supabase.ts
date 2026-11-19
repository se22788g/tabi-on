"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { ensureAnonymousSession } from "./anonymous";
import { getBrowserSupabase } from "./browser";

export type SupabaseState =
  | { status: "loading" }
  /** .env.local に Supabase の URL とキーがない */
  | { status: "unconfigured" }
  | { status: "failed" }
  | { status: "ready"; client: SupabaseClient; userId: string };

/** 匿名ログインがすんだ Supabase クライアント。画面は ready になってからデータを読む */
export function useSupabase(): SupabaseState {
  const [state, setState] = useState<SupabaseState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    const client = getBrowserSupabase();
    if (!client) {
      setState({ status: "unconfigured" });
      return;
    }
    ensureAnonymousSession(client).then((userId) => {
      if (!alive) return;
      setState(userId ? { status: "ready", client, userId } : { status: "failed" });
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
