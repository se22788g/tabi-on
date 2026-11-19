"use client";

import { useEffect } from "react";
import { ensureAnonymousSession } from "@/lib/db/anonymous";
import { getBrowserSupabase } from "@/lib/db/browser";

/** どの画面を開いても、最初に匿名ログインさせる（画面には何も出さない） */
export function EnsureSession() {
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (supabase) void ensureAnonymousSession(supabase);
  }, []);
  return null;
}
