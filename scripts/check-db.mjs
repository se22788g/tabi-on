// Supabase の設定が正しいか、手元で確かめる（キーは表示しない）。
// 使い方: node --env-file=.env.local scripts/check-db.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.log("NG  .env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を入れてください");
  process.exit(1);
}
let ng = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "OK " : "NG "} ${name}${extra ? `  ${extra}` : ""}`);
  if (!ok) ng++;
};

const anonClient = createClient(url, anon, { auth: { persistSession: false } });
const spots = await anonClient.from("spots").select("id", { count: "exact", head: true });
check("ログイン前でも spots が読める・56件", !spots.error && spots.count === 56, spots.error ? spots.error.message : `${spots.count}件`);

const trips = await anonClient.from("trips").select("id").limit(1);
check("ログイン前は trips が読めない（権限なし）", Boolean(trips.error));

const signIn = await anonClient.auth.signInAnonymously();
check("匿名ログインできる", !signIn.error, signIn.error ? `${signIn.error.message}（Authentication → Sign In / Providers → Allow anonymous sign-ins をオン）` : "");
if (!signIn.error) {
  const mine = await anonClient.from("trips").select("id");
  check("ログイン後、自分の旅は0件（エラーなし）", !mine.error && mine.data.length === 0, mine.error?.message ?? "");
  const wrong = await anonClient.from("trips").insert({ code: "TABI-CHECK", owner_id: "00000000-0000-0000-0000-000000000000" });
  check("他人を owner にした旅は作れない（RLS）", Boolean(wrong.error));
  await anonClient.auth.signOut();
}
console.log(ng ? `${ng} 件 NG` : "すべて OK");
process.exit(ng ? 1 : 0);
