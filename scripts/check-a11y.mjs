// 受け入れ基準の機械的な確認：押せるものの高さ、タブバーの有無、ヘッダーの位置、横スクロール
// 段階3から、旅の画面は偽の Supabase（scripts/fake-supabase.mjs）のデータで開く。偽のURLを埋め込んだビルドを動かしたうえで使う。
import { chromium } from "playwright-core";
import { installFakeSupabase } from "./fake-supabase.mjs";
import { makeFixture } from "./fake-fixtures.mjs";

const base = process.argv[2] ?? "http://localhost:3000";
const { db, me, T, T2 } = makeFixture();
const F = ["/trips/new", `/trips/${T}/invite`, "/j/TABI-WXYZ", "/j", `/trips/${T}/q/1`, `/trips/${T}/q/2`, `/trips/${T}/q/12`, `/trips/${T}/intro`, `/trips/${T}/rate`];
const M = ["/trips", `/trips/${T}/plan`, "/spots/yamagata-ginzan-yukimi-buro", "/me", "/me/tendency", "/me/visited"];
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await installFakeSupabase(ctx, db, { userId: me });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errors.push(m.text()));
let bad = 0;
for (const path of [...F, ...M]) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  const r = await page.evaluate(() => {
    const small = [...document.querySelectorAll("button, a, input, summary")]
      .filter((el) => el.getClientRects().length && !el.closest(".sheet-backdrop"))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 43.5 || r.width < 43.5)
      .map(({ el, r }) => `${el.tagName}.${el.className}「${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 14)}」${Math.round(r.width)}×${Math.round(r.height)}`);
    const hdr = document.querySelector(".app-header")?.getBoundingClientRect();
    const text = document.body.innerText;
    return {
      small,
      tabbar: !!document.querySelector(".tab-bar"),
      header: hdr ? { top: hdr.top, h: Math.round(hdr.height) } : null,
      hscroll: document.documentElement.scrollWidth > window.innerWidth,
      english: (text.match(/\b(NEW TRIP|MORE IDEAS|MY TRAVEL STYLE|NEXT WISH|INVITATION CODE|WHAT YOU LOVE|YOUR PREFERENCES)\b/g) || []),
      menu: !!document.querySelector('[aria-label="メニュー"]'),
    };
  });
  const isM = M.includes(path);
  const problems = [];
  if (r.small.length) problems.push("小さい:" + r.small.join(" / "));
  if (r.tabbar !== isM) problems.push(`タブバー ${r.tabbar}（期待 ${isM}）`);
  if (!r.header || r.header.top !== 0 || r.header.h < 56) problems.push("ヘッダー " + JSON.stringify(r.header));
  if (r.hscroll) problems.push("横スクロール");
  if (r.english.length) problems.push("英字小見出し " + r.english);
  if (r.menu) problems.push("ハンバーガー");
  console.log(problems.length ? "NG " : "OK ", path, problems.join(" | "));
  bad += problems.length;
}
console.log("console errors:", errors.length ? errors : "なし");
await browser.close();
process.exit(bad ? 1 : 0);
