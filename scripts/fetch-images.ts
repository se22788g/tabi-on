// 仕様書「写真の用意の仕方」：56件の spots すべてに、写真を入れる。
//   1. Figma Make で使っている写真があれば、そのエリアに使う（すでに spots.json に入っている6件）。
//   2. UNSPLASH_ACCESS_KEY があれば、Unsplash API をエリア名＋内容の英語キーワードで検索し、URL と撮影者名を images に入れる。
//   3. どちらもなければ、画面が、category ごとの淡い色の背景にエリア名の代わりの画像を出す。
//
// 使い方：node --env-file=.env.local scripts/fetch-images.ts [--limit N] [--replace-figma] [--dry]
//   （Node 22.6 以上。TypeScript の型は、Node がそのまま読み飛ばす。キーは .env.local に入れておく。画面にもログにも出さない）
//
// ・途中で止まっても、続きから再開できる：写真のない spots だけを探し、1件取れるたびに supabase/seed/spots.json と Supabase に書く。
//   Unsplash は、デモのうちは 1時間に50回まで（X-Ratelimit-Remaining を見て、足りなくなったら止まる）。止まったら、1時間あけて、もう一度流す。
// ・Unsplash の API ガイドライン（https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines）を守る：
//   - API が返した URL（urls.regular）を、そのまま埋め込む。ダウンロードして自分で配らない。ixid などは消さない（画面側の sizedUrl は w だけを変える）。
//   - 写真を使うとき、download_location に通知を送る（認証つき）。選んだ写真ごとに、1回だけ。
//   - 撮影者と Unsplash を、utm_source=tabi-on&utm_medium=referral つきのリンクで出す（画面側。PhotoCredit）。credit_url には、撮影者のページを入れる。
//   - アクセスキーは、このスクリプト（サーバー側）だけで使う。ブラウザには出さない。
import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SEED = "supabase/seed/spots.json";
const KEY = process.env.UNSPLASH_ACCESS_KEY;
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const replaceFigma = args.includes("--replace-figma");
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;

type Img = { url: string; credit: string; credit_url: string; id?: string; download_location?: string; tracked?: boolean };
type Spot = { id: string; area: string; category: string; images: Img[] };

const AREA_EN: Record<string, string> = {
  "hokkaido-otaru": "Otaru Hokkaido", "yamagata-ginzan": "Ginzan Onsen Yamagata", "yamagata-zao": "Zao Yamagata",
  "yamagata-yamadera": "Yamadera Yamagata", "kanagawa-hakone": "Hakone", "yamanashi-kawaguchiko": "Lake Kawaguchi",
  "nagano-shibu": "Shibu Onsen Nagano", "nagano-hakuba": "Hakuba Nagano", "ishikawa-kanazawa": "Kanazawa",
  "gifu-shirakawago": "Shirakawa-go", "kyoto-arashiyama": "Arashiyama Kyoto", "hyogo-kinosaki": "Kinosaki Onsen",
  "hiroshima-miyajima": "Miyajima Hiroshima", "fukuoka-itoshima": "Itoshima Fukuoka",
};
const CATEGORY_EN: Record<string, string> = {
  food: "japanese food", nature: "landscape", onsen: "hot spring", activity: "outdoor", town: "street", culture: "temple", stay: "ryokan",
};

const spots: Spot[] = JSON.parse(readFileSync(SEED, "utf8"));
const save = () => {
  if (dry) return;
  writeFileSync(`${SEED}.tmp`, `${JSON.stringify(spots, null, 2)}\n`);
  renameSync(`${SEED}.tmp`, SEED);
};

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;
const pushToDb = async (s: Spot): Promise<boolean> => {
  if (!supabase || dry) return false;
  const { error } = await supabase.from("spots").update({ images: s.images }).eq("id", s.id);
  if (error) console.log(`  Supabase への書き込みに失敗: ${s.id}（${error.message}）`);
  return !error;
};

let remaining: number | null = null; // X-Ratelimit-Remaining
let stopped: string | null = null;
const api = async (url: string): Promise<Response | null> => {
  if (stopped) return null;
  if (remaining !== null && remaining <= 1) {
    stopped = "Unsplash の1時間あたりの回数（デモは50回）を使い切りました";
    return null;
  }
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${KEY}`, "Accept-Version": "v1" } });
  const r = res.headers.get("x-ratelimit-remaining");
  if (r !== null) remaining = Number(r);
  if (res.status === 401) stopped = "UNSPLASH_ACCESS_KEY が正しくありません（401）";
  else if (res.status === 403 || res.status === 429) stopped = "Unsplash の1時間あたりの回数を使い切りました";
  if (stopped) return null;
  return res;
};

const used = () => new Set(spots.flatMap((s) => s.images.map((i) => i.id).filter(Boolean)));
const targets = spots.filter((s) => s.images.length === 0 || (replaceFigma && s.images.every((i) => !i.id)));
const failed: string[] = [];
let fetched = 0;

console.log(`spots ${spots.length}件。写真あり ${spots.filter((s) => s.images.length > 0).length}件。これから探す ${targets.length}件${dry ? "（--dry：何も書き込まない）" : ""}`);
if (!KEY && targets.length > 0) console.log("UNSPLASH_ACCESS_KEY がないので、写真は探しません（画面は、代わりの画像を出します）");

// ---- 1. 検索して、写真と撮影者を入れる ----
for (const s of KEY ? targets : []) {
  if (fetched >= limit || stopped) break;
  const areaKey = s.id.split("-").slice(0, 2).join("-");
  const area = AREA_EN[areaKey] ?? s.area;
  const queries = [`${area} ${CATEGORY_EN[s.category] ?? ""}`.trim(), `${area} Japan`];
  let chosen: Img | null = null;
  for (const q of queries) {
    const res = await api(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=10&orientation=landscape&content_filter=high`);
    if (!res) break;
    if (!res.ok) {
      console.log(`  ${s.id}: 検索に失敗（${res.status}）`);
      continue;
    }
    const body = (await res.json()) as { results?: { id: string; urls: { regular: string }; user: { name: string; links: { html: string } }; links: { download_location: string } }[] };
    const taken = used();
    const p = (body.results ?? []).find((r) => !taken.has(r.id));
    if (p) {
      chosen = { url: p.urls.regular, credit: p.user.name, credit_url: p.user.links.html, id: p.id, download_location: p.links.download_location, tracked: false };
      break;
    }
  }
  if (!chosen) {
    if (!stopped) failed.push(s.id);
    continue;
  }
  s.images = [chosen];
  save();
  const ok = await pushToDb(s);
  fetched++;
  console.log(`  ${s.id}: ${chosen.credit}${ok ? "（Supabase に保存）" : ""}`);
}

// ---- 2. 使った写真ごとに、ダウンロードの通知を、1回だけ送る（規約）。回数が足りなければ、次の回に回す ----
let tracked = 0;
if (KEY && !dry) {
  for (const s of spots) {
    for (const img of s.images) {
      if (!img.download_location || img.tracked || stopped) continue;
      const res = await api(img.download_location);
      if (!res) break;
      if (res.ok) {
        img.tracked = true;
        tracked++;
        save();
        await pushToDb(s);
      }
    }
  }
}

// ---- 3. spots.json と Supabase のずれを直す（以前の回で、書き込みに失敗したものなど）----
let synced = 0;
if (supabase && !dry) {
  const { data } = await supabase.from("spots").select("id, images");
  const inDb = new Map((data ?? []).map((r) => [r.id as string, JSON.stringify(r.images)]));
  for (const s of spots) {
    if (JSON.stringify(s.images) !== inDb.get(s.id) && (await pushToDb(s))) synced++;
  }
} else if (!supabase) {
  console.log("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY がないので、Supabase への書き込みはしません（spots.json だけ更新）");
}

// ---- 4. seed の SQL を作り直す ----
if (!dry && (fetched > 0 || synced > 0 || tracked > 0)) execFileSync("node", ["scripts/build-sql.mjs"], { stdio: "inherit" });

const withImages = spots.filter((s) => s.images.length > 0).length;
const pending = spots.flatMap((s) => s.images.filter((i) => i.download_location && !i.tracked).map(() => s.id));
console.log("\n--- 結果 ---");
console.log(`写真あり ${withImages} / ${spots.length}件（今回 ${fetched}件を追加、ダウンロード通知 ${tracked}件、Supabase の修正 ${synced}件）`);
if (remaining !== null) console.log(`Unsplash の残り回数：${remaining}`);
const missing = spots.filter((s) => s.images.length === 0).map((s) => s.id);
if (failed.length) console.log(`検索で見つからなかった場所（${failed.length}件）：\n  ${failed.join("\n  ")}`);
if (missing.length) console.log(`まだ写真がない場所（${missing.length}件）。${stopped ? `止まった理由：${stopped}。1時間あけて、もう一度流してください` : ""}`);
if (pending.length) console.log(`ダウンロードの通知が、まだの写真：${pending.length}件（次の回で送ります）`);
if (!missing.length && !pending.length) console.log("すべて完了");
process.exit(0);
