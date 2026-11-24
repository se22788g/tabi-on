// 写真を出す画面（F6・M3・M4・M5・M7）のスクリーンショットを撮る。偽のデータで、写真は本物の Unsplash から読み込む。
// 使い方: （偽のURLを埋め込んだビルドを動かしたうえで）node scripts/screens-photos.mjs <保存先> [baseUrl]
import { chromium } from "playwright-core";
import { randomUUID } from "node:crypto";
import { installFakeSupabase } from "./fake-supabase.mjs";
import { makeFixture } from "./fake-fixtures.mjs";

const out = process.argv[2] ?? "docs/screens/photos";
const base = process.argv.find((a) => /^https?:/.test(a)) ?? "http://localhost:3000";
const { db, me, T } = makeFixture();
// サイトにない場所と、行った記録を足す
db.plan_items.push({ id: randomUUID(), trip_id: T, day: 2, position: 20, spot_id: null, title: "熊野古道", time_hint: "13:00", pinned: false, edited_by_user: true, source: "user" });
for (const id of ["hokkaido-otaru-kaisen-donburi", "yamagata-ginzan-soba-kawaoto"]) db.visits.push({ user_id: me, spot_id: id, again: id.startsWith("hokkaido"), created_at: new Date().toISOString() });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ja-JP" });
await installFakeSupabase(ctx, db, { userId: me });
const page = await ctx.newPage();
const bad = [];
page.on("response", (r) => { if (r.url().includes("images.unsplash.com") && r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 80)}`); });
const shot = async (name) => { await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/${name}.png` }); };
const go = async (path, sel) => { await page.goto(base + path, { waitUntil: "load" }); await page.waitForSelector(sel, { timeout: 15000 }); };

await go(`/trips/${T}/plan`, ".plan-item");
await shot("M3-plan");
await page.locator(".plan-item", { hasText: "熊野古道" }).scrollIntoViewIfNeeded();
await shot("M3-plan-free");
await page.evaluate(() => window.scrollTo(0, 0));
await page.locator(".plan-item .main").first().click();
await page.waitForSelector(".sheet");
await shot("M3-plan-detail");
await page.keyboard.press("Escape");
await go(`/trips/${T}/rate`, ".candidate-card");
await shot("F6-rate");
await page.locator(".photo-btn").click();
await page.waitForSelector(".sheet");
await shot("F6-rate-sheet");
await go("/spots/hokkaido-otaru-kaisen-donburi", "h1");
await shot("M4-spot");
await go("/me", ".wish-card");
await shot("M5-me");
await go("/me/visited", ".visit-row");
await shot("M7-visited");
await browser.close();
console.log(bad.length ? `NG 写真の読み込みに失敗: ${bad.join(" / ")}` : "写真の読み込みは、すべて成功");
