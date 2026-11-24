// 全画面の、下の固定枠（タブバー・メインボタンの枠）の高さと、本文の下余白を測り、スクリーンショットを撮る。
// 使い方: （偽のURLを埋め込んだビルドを動かしたうえで）node scripts/measure-bottom.mjs <保存先> [baseUrl] [--inset=34]
//   --inset=N  iPhone のホームインジケーターの高さ（safe-area-inset-bottom）を N px として試す。Safari のブラウザ表示は小さい（0〜）、
//              ホーム画面に追加すると 34 前後。env() は PC では指定できないので、変数を直接上書きする
import { chromium } from "playwright-core";
import { installFakeSupabase } from "./fake-supabase.mjs";
import { makeFixture } from "./fake-fixtures.mjs";

const out = process.argv[2];
const base = process.argv.find((a) => /^https?:/.test(a)) ?? "http://localhost:3000";
const inset = process.argv.find((a) => a.startsWith("--inset="))?.split("=")[1];
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
  await page.goto(base + path, { waitUntil: "load" });
  await page.waitForSelector(".app-header", { timeout: 15000 });
  await page.waitForTimeout(2200);
  if (inset) await page.addStyleTag({ content: `:root{--safe-bottom:${inset}px!important}` });
  // 一番下までスクロールして、最後の中身と、下の固定枠の間を測る
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const bar = document.querySelector(".tab-bar") ?? document.querySelector(".bottom-bar");
    const kind = document.querySelector(".tab-bar") ? "タブバー" : document.querySelector(".bottom-bar") ? "メインボタンの枠" : "なし";
    const b = bar?.getBoundingClientRect();
    const main = document.querySelector(".screen");
    const kids = [...main.children].filter((el) => el.getClientRects().length && getComputedStyle(el).position !== "fixed");
    const last = kids[kids.length - 1];
    const lastBottom = last ? last.getBoundingClientRect().bottom : null;
    const tabs = [...document.querySelectorAll(".tab-bar a")].map((a) => a.getBoundingClientRect());
    const btn = document.querySelector(".bottom-bar .primary-btn")?.getBoundingClientRect();
    return {
      kind,
      barHeight: b ? Math.round(b.height) : null,
      barPaddingBottom: bar ? Math.round(parseFloat(getComputedStyle(bar).paddingBottom)) : null,
      mainPaddingBottom: Math.round(parseFloat(getComputedStyle(main).paddingBottom)),
      gapContentToBar: b && lastBottom !== null ? Math.round(b.top - lastBottom) : null,
      tabTapMin: tabs.length ? Math.round(Math.min(...tabs.map((t) => Math.min(t.width, t.height)))) : null,
      buttonHeight: btn ? Math.round(btn.height) : null,
      hscroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  rows.push({ name, ...r });
  if (out) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${out}/${name}.png` }); }
}
console.table(rows);
const bars = rows.filter((r) => r.barHeight);
console.log(JSON.stringify({
  inset: inset ?? "（なし：下限だけ）",
  tabBarHeights: [...new Set(rows.filter((r) => r.kind === "タブバー").map((r) => r.barHeight))],
  mainButtonBarHeights: [...new Set(rows.filter((r) => r.kind === "メインボタンの枠").map((r) => r.barHeight))],
  mainPaddingBottoms: [...new Set(rows.map((r) => r.mainPaddingBottom))],
  contentHiddenBehindBar: bars.filter((r) => r.gapContentToBar < 0).map((r) => r.name),
  smallTabTargets: rows.filter((r) => r.tabTapMin !== null && r.tabTapMin < 44).map((r) => r.name),
  hscroll: rows.filter((r) => r.hscroll).map((r) => r.name),
}));
await browser.close();
