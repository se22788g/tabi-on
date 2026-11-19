import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { ensureAnonymousSession } from "./anonymous";

function fakeClient() {
  let session: { user: { id: string } } | null = null;
  const signInAnonymously = vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 20)); // 通信にかかる時間
    session = { user: { id: `user-${signInAnonymously.mock.calls.length}` } };
    return { data: { user: session.user }, error: null };
  });
  const getSession = vi.fn(async () => ({ data: { session } }));
  return { client: { auth: { getSession, signInAnonymously } } as unknown as SupabaseClient, signInAnonymously };
}

describe("ensureAnonymousSession", () => {
  it("同時に何回呼んでも、匿名ログインは1回だけ。みんな同じユーザー id を受け取る", async () => {
    const { client, signInAnonymously } = fakeClient();
    const ids = await Promise.all([ensureAnonymousSession(client), ensureAnonymousSession(client), ensureAnonymousSession(client)]);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe("user-1");
  });
  it("すでにログインしていれば、もう一度ログインしない", async () => {
    const { client, signInAnonymously } = fakeClient();
    await ensureAnonymousSession(client);
    expect(await ensureAnonymousSession(client)).toBe("user-1");
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });
  it("失敗したら null を返し、次に呼んだときは、もう一度ためす", async () => {
    const signInAnonymously = vi.fn(async () => ({ data: { user: null }, error: { message: "boom" } }));
    const client = { auth: { getSession: async () => ({ data: { session: null } }), signInAnonymously } } as unknown as SupabaseClient;
    expect(await ensureAnonymousSession(client)).toBeNull();
    expect(await ensureAnonymousSession(client)).toBeNull();
    expect(signInAnonymously).toHaveBeenCalledTimes(2);
  });
});
