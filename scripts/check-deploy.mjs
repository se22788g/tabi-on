// 公開したあと、公開URLが正しく動いているかを、外から確かめる。キーや秘密の値は表示しない。
// 使い方: node scripts/check-deploy.mjs https://（公開URL） [--local] [--no-supabase]
//   --local        自分のパソコン（http://localhost）に対して試すとき。URL が https でなくても、Supabase の URL が localhost でも、NG にしない
//   --no-supabase  Supabase に問い合わせる確認（spots が56件読めるか、など）を飛ばす
const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "").replace(/\/$/, "");
const local = args.includes("--local");
const skipSupabase = args.includes("--no-supabase");
if (!base) {
  console.log("使い方: node scripts/check-deploy.mjs https://（公開URL） [--local] [--no-supabase]");
  process.exit(1);
}
let ng = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "OK " : "NG "} ${name}${!cond && extra ? `  ← ${extra}` : ""}`);
  if (!cond) ng++;
};
const get = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init });

// ---- 画面 ----
ok("公開URLが https", base.startsWith("https://") || local, base);
const root = await get("/");
ok("/ を開くと /trips に移る", [307, 308].includes(root.status) && new URL(root.headers.get("location") ?? "/", base).pathname === "/trips", `status ${root.status}`);
const pages = { "/trips": "旅", "/trips/new": "旅をはじめよう", "/j": "招待コード", "/me": "マイページ", "/spots/yamagata-ginzan-yukimi-buro": "" };
const html = {};
for (const [path] of Object.entries(pages)) {
  const r = await get(path);
  html[path] = await r.text();
  ok(`${path} が開く（200）`, r.status === 200, `status ${r.status}`);
}
ok("日本語のページ（lang=ja）で、viewport-fit=cover", /<html[^>]*lang="ja"/.test(html["/trips"]) && /viewport-fit=cover/.test(html["/trips"]));
ok("テーマ色とホーム画面用の設定", /name="theme-color"/.test(html["/trips"]) && /apple-mobile-web-app-title/.test(html["/trips"]));
ok("LINE などに貼ったときの表示（og:title）", /property="og:title" content="たびおん"/.test(html["/trips"]));

// ---- PWA ----
const mf = await get("/manifest.webmanifest");
const manifest = mf.ok ? await mf.json() : null;
ok("manifest：名前「たびおん」、standalone", manifest?.name === "たびおん" && manifest?.display === "standalone");
for (const icon of manifest?.icons ?? []) {
  const r = await get(icon.src);
  ok(`アイコン ${icon.sizes}`, r.status === 200 && (r.headers.get("content-type") ?? "").includes("image/png"));
}
for (const p of ["/icon.png", "/apple-icon.png"]) ok(`${p} が開く`, (await get(p)).status === 200);

// ---- メールのリンクの戻り先 ----
const cb = await get("/auth/callback?code=invalid&next=//evil.example");
const loc = cb.headers.get("location") ?? "";
ok("/auth/callback：使えない code は、マイページ（?account=failed）に戻す。外のサイトには飛ばさない", [307, 308].includes(cb.status) && new URL(loc, base).origin === new URL(base).origin && /account=failed/.test(loc), `${cb.status} ${loc}`);

// ---- ブラウザに出る JavaScript に、秘密の値が入っていないか ----
const scripts = new Set();
for (const h of Object.values(html)) for (const m of h.matchAll(/\/_next\/static\/[^"')\s]+\.js/g)) scripts.add(m[0]);
let bundle = "";
for (const s of scripts) bundle += await (await get(s)).text();
ok(`JavaScript を読めた（${scripts.size}ファイル）`, scripts.size > 0);
const jwts = [...bundle.matchAll(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g)].map((m) => m[0]);
const role = (t) => { try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).role; } catch { return null; } };
ok("ブラウザに出る JavaScript に service_role キーがない", !jwts.some((t) => role(t) === "service_role") && !/sb_secret_[\w-]{20,}/.test(bundle)); // supabase-js のコードにある「sb_secret_」という前置きの判定は、キーそのものではないので数えない
ok("ブラウザに出る JavaScript に Anthropic のキーがない", !/sk-ant-/.test(bundle) && !/ANTHROPIC_API_KEY/.test(bundle));
ok("ブラウザに出る JavaScript に、秘密の変数の名前がない", !/SUPABASE_SERVICE_ROLE_KEY|UNSPLASH_ACCESS_KEY/.test(bundle));
const supaUrl = bundle.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0] ?? null;
ok("Supabase の URL（https://….supabase.co）が入っている", Boolean(supaUrl) || local || skipSupabase, "NEXT_PUBLIC_SUPABASE_URL が入っていません");
const anon = jwts.find((t) => role(t) === "anon") ?? bundle.match(/sb_publishable_[\w-]{20,}/)?.[0] ?? null;

// ---- Supabase（公開キーだけで、外から）----
if (!skipSupabase && supaUrl && anon) {
  const h = { apikey: anon, authorization: `Bearer ${anon}`, prefer: "count=exact" };
  const spots = await fetch(`${supaUrl}/rest/v1/spots?select=id&limit=1`, { headers: h });
  const count = Number((spots.headers.get("content-range") ?? "").split("/")[1]);
  ok("ログイン前でも spots が読める・56件", spots.ok && count === 56, `status ${spots.status}, ${count}件`);
  const trips = await fetch(`${supaUrl}/rest/v1/trips?select=id&limit=1`, { headers: h });
  ok("ログイン前は trips が読めない（権限なし）", !trips.ok);
  const ratings = await fetch(`${supaUrl}/rest/v1/ratings?select=*&limit=1`, { headers: h });
  ok("ログイン前は ratings が読めない（権限なし）", !ratings.ok);
  const rpc = await fetch(`${supaUrl}/rest/v1/rpc/save_plan`, { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ p_trip_id: "00000000-0000-0000-0000-000000000000", p_title: "x", p_source: "rule", p_reason: "x", p_items: [], p_actor_member_id: null }) });
  ok("ログイン前は、サーバー専用の関数（save_plan）を呼べない", !rpc.ok);
  const settings = await fetch(`${supaUrl}/auth/v1/settings`, { headers: { apikey: anon } });
  const st = settings.ok ? await settings.json() : null;
  ok("匿名ログインがオン", st?.external?.anonymous_users === true || st?.disable_signup === false, "Authentication → Sign In / Providers で Allow anonymous sign-ins をオンに");
  ok("メールでのログインがオン", st?.external?.email === true);
  ok("Google ログインは、オフのまま", st?.external?.google !== true);
}
console.log(ng ? `${ng} 件 NG` : "すべて OK");
process.exit(ng ? 1 : 0);
