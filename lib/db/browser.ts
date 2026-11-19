"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "./env";

let client: SupabaseClient | null | undefined;

/** ブラウザ用の Supabase クライアント（anon キー）。環境変数が無ければ null */
export function getBrowserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const env = getPublicEnv();
  client = env ? createBrowserClient(env.url, env.anonKey) : null;
  return client;
}
