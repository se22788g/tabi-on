// アクセシビリティの機械的な確認（段階6）：キーボードの Tab で、押せるものすべてにたどり着ける／フォーカスが見える／
// シートの中にフォーカスが閉じ込められ、閉じたら元に戻る／「視差効果を減らす」でカードの動きが止まる／画面を移ると一番上に戻る
// 使い方: （偽のURLを埋め込んだビルドを動かしたうえで）node scripts/check-keyboard.mjs [baseUrl]
import { chromium } from "playwright-core";
import { installFakeSupabase } from "./fake-supabase.mjs";
import { makeFixture } from "./fake-fixtures.mjs";

const base = process.argv[2] ?? "http://localhost:3000";
const { db, me, T } = makeFixture();
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await installFakeSupabase(ctx, db, { userId: me });
const page = await ctx.newPage();
let fail = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "OK  " : "NG  "}${name}${!cond && extra ? `  ← ${extra}` : ""}`); if (!cond) fail++; };

const PAGES = ["/trips/new", `/trips/${T}/invite`, "/j/TABI-WXYZ", `/trips/${T}/q/1`, `/trips/${T}/q/12`, `/trips/${T}/intro`, `/trips/${T}/rate`, "/trips", `/trips/${T}/plan`, "/spots/yamagata-ginzan-yukimi-buro", "/me", "/me/tendency", "/me/visited"];

/** 押せるもの（見えていて、無効でなく、tabindex=-1 でない） */
const interactive = () => page.evaluate(() =>
  [...document.querySelectorAll("a[href], button, input, select, textarea, summary")]
    .filter((el) => el.getClientRects().length && !el.disabled && el.getAttribute("tabindex") !== "-1" && getComputedStyle(el).visibility !== "hidden")
    .map((el) => (el.getAttribute("aria-label") || el.textContent || el.placeholder || el.tagName).trim().slice(0, 16)));

for (const path of PAGES) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const want = await interactive();
  const seen = new Set();
  let visibleFocus = true;
  for (let i = 0; i < want.length + 6; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      // 検索欄のように、入力欄の外側の枠（.text-input）が輪を出すものもある
      const cs = getComputedStyle(el.closest(".text-input") && getComputedStyle(el).outlineStyle === "none" ? el.closest(".text-input") : el);
      const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      return { name: (el.getAttribute("aria-label") || el.textContent || el.placeholder || el.tagName).trim().slice(0, 16), outline, shadow: cs.boxShadow !== "none" };
    });
    if (r) { seen.add(r.name); if (!r.outline && !r.shadow) visibleFocus = false; }
  }
  const missed = want.filter((n) => !seen.has(n));
  ok(`${path}：Tab で、押せるものすべてにたどり着ける`, missed.length === 0, `届かない: ${missed.join(" / ")}`);
  ok(`${path}：フォーカスが見える`, visibleFocus);
}

// シート：フォーカスが中に入り、Tab を続けても外に出ず、Escape で閉じると、開いたボタンに戻る
await page.goto(`${base}/trips/${T}/plan`, { waitUntil: "networkidle" });
await page.waitForSelector(".plan-item");
const opener = page.locator(".plan-item .more").first();
await opener.focus();
await page.keyboard.press("Enter");
await page.waitForSelector(".sheet");
ok("シート：開くとフォーカスがシートの中に入る", await page.evaluate(() => !!document.activeElement?.closest(".sheet")));
let escaped = false;
for (let i = 0; i < 14; i++) { await page.keyboard.press("Tab"); if (!(await page.evaluate(() => !!document.activeElement?.closest(".sheet")))) escaped = true; }
ok("シート：Tab を続けても、フォーカスがシートの外に出ない", !escaped);
let escapedBack = false;
for (let i = 0; i < 14; i++) { await page.keyboard.press("Shift+Tab"); if (!(await page.evaluate(() => !!document.activeElement?.closest(".sheet")))) escapedBack = true; }
ok("シート：Shift+Tab でも、外に出ない", !escapedBack);
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
ok("シート：閉じると、開いたボタンにフォーカスが戻る", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "予定のメニュー"));

// 視差効果を減らす
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(`${base}/trips/${T}/rate`, { waitUntil: "networkidle" });
await page.waitForSelector(".candidate-card");
await page.getByRole("button", { name: "行きたい", exact: true }).click();
await page.waitForTimeout(100);
const anim = await page.evaluate(() => getComputedStyle(document.querySelector(".candidate-card")).animationName);
ok("視差効果を減らす：カードが飛ぶ動きをやめる（切り替えだけ）", anim === "none", anim);
await page.emulateMedia({ reducedMotion: "no-preference" });

// 画面を移ると、一番上に戻る
await page.goto(`${base}/me`, { waitUntil: "networkidle" });
await page.waitForSelector(".wish-card");
await page.evaluate(() => { window.scrollTo(0, 600); document.querySelector("main")?.scrollTo?.(0, 600); });
const before = await page.evaluate(() => window.scrollY);
await page.getByRole("link", { name: /あなたの旅の傾向/ }).click();
await page.waitForURL(/tendency/);
await page.waitForTimeout(400);
ok("画面を移ると、一番上までスクロールが戻る", before > 100 && (await page.evaluate(() => window.scrollY)) === 0, `移る前 ${before}`);
await browser.close();
console.log(fail ? `${fail} 件 NG` : "すべて OK");
process.exit(fail ? 1 : 0);
