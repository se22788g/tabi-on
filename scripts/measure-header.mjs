// 全画面のヘッダーの高さと、本文の上余白を測り、スクリーンショットを撮る。
// 使い方: （偽のURLを埋め込んだビルドを動かしたうえで）node scripts/measure-header.mjs <保存先> [baseUrl] [--inset=59]
//   --inset=N  iPhone のステータスバーの高さ（safe-area-inset-top）を、N px として試す（Safari のブラウザ表示は 0、ホーム画面に追加すると 47〜59）
import { chromium } from "playwright-core";
import { installFakeSupabase } from "./fake-supabase.mjs";
import { makeFixture } from "./fake-fixtures.mjs";

const out = process.argv[2];
const base = process.argv.find((a) => /^https?:/.test(a)) ?? "http://localhost:3000";
const inset = Number((process.argv.find((a) => a.startsWith("--inset=")) ?? "--inset=0").split("=")[1]);
const { db, me, T } = makeFixture();
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ja-JP" });
await installFakeSupabase(ctx, db, { userId: me });
const page = await ctx.newPage();
const PAGES = [
  ["F1-start", "/trips/new"], ["F2-invite", `/trips/${T}/invite`], ["F3-join", "/j/TABI-WXYZ"], ["F3-code", "/j"],
  ["F4-q1", `/trips/${T}/q/1`], ["F4-q12", `/trips/${T}/q/12`], ["F5-intro", `/trips/${T}/intro`], ["F6-rate", `/trips/${T}/rate`],
  ["M2-trips", "/trips"], ["M3-plan", `/trips/${T}/plan`], ["M4-spot", "/spots/yamagata-ginzan-yukimi-buro"],
  ["M5-me", "/me"], ["M6-tendency", "/me/tendency"], ["M7-visited", "/me/visited"],
];
const rows = [];
for (const [name, path] of PAGES) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  // iPhone の safe-area-inset-top を、N px として試す（env() は、PCの Chrome では指定できないため、変数を直接上書きする）
  if (inset > 0) await page.addStyleTag({ content: `:root{--safe-top:${inset}px!important}` });
  const r = await page.evaluate(() => {
    const h = document.querySelector(".app-header").getBoundingClientRect();
    const main = document.querySelector("main.screen, .screen");
    const pt = parseFloat(getComputedStyle(main).paddingTop);
    // 本文の最初の要素の上端（ヘッダーの下から、どれだけ空いているか）
    const first = [...main.children].find((el) => el.getClientRects().length);
    const firstTop = first ? first.getBoundingClientRect().top : null;
    const slots = [...document.querySelectorAll(".app-header .icon-btn, .app-header .header-text-btn, .app-header a, .app-header button")].map((el) => el.getBoundingClientRect());
    const hdrBottom = h.bottom;
    const title = document.querySelector(".app-header .header-title, .app-header .header-center");
    return {
      headerHeight: Math.round(h.height),
      mainPaddingTop: Math.round(pt),
      gapToFirst: firstTop === null ? null : Math.round(firstTop - hdrBottom),
      smallTargets: slots.filter((s) => s.width < 43.5 || s.height < 43.5).length,
      overlap: firstTop !== null && firstTop < hdrBottom - 0.5,
      titleClipped: title ? title.scrollWidth > title.clientWidth + 1 : false,
      hscroll: document.documentElement.scrollWidth > window.innerWidth,
      scrollable: document.documentElement.scrollHeight - window.innerHeight,
    };
  });
  rows.push({ name, ...r });
  if (out) await page.screenshot({ path: `${out}/${name}.png` });
}
console.table(rows);
console.log(JSON.stringify({ inset, headerHeights: [...new Set(rows.map((r) => r.headerHeight))], mainPaddingTops: [...new Set(rows.map((r) => r.mainPaddingTop))], overlaps: rows.filter((r) => r.overlap).map((r) => r.name), smallTargets: rows.filter((r) => r.smallTargets).map((r) => r.name), clipped: rows.filter((r) => r.titleClipped).map((r) => r.name), hscroll: rows.filter((r) => r.hscroll).map((r) => r.name) }));
await browser.close();
