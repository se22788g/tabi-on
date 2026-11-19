// 調査用：マイページの「メールで続ける」で、1文字ごとに、入力欄が作り直されたか・フォーカスを誰が外したかを調べる。
// 使い方: node scripts/probe-focus.mjs [chromium|webkit] [--keyboard] [--refresh]
//   --keyboard  入力欄にフォーカスしたら、iPhone のキーボードの高さの分だけ、画面の高さを縮める
//   --refresh   匿名ログインのセッションの期限を短くして、実際にトークンの更新が起きる状態にする
import { chromium, webkit, devices } from "playwright-core";
import { installFakeSupabase } from "./fake-supabase.mjs";
import { makeFixture } from "./fake-fixtures.mjs";

const engine = process.argv[2] === "webkit" ? "webkit" : "chromium";
const keyboard = process.argv.includes("--keyboard");
const refresh = process.argv.includes("--refresh");
const base = process.argv.find((a) => /^https?:/.test(a)) ?? "http://localhost:3000";
const { db, me } = makeFixture();
db.sessionSeconds = refresh ? 5 : 3600;
const browser = engine === "webkit"
  ? await webkit.launch()
  : await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ ...devices["iPhone 14"], locale: "ja-JP" });
await installFakeSupabase(ctx, db, { userId: me });
// フォーカスを動かす・外す呼び出しの記録（呼び出した場所のスタックつき）と、要素が消えた記録
await ctx.addInitScript(() => {
  window.__log = [];
  for (const m of ["focus", "blur"]) {
    const orig = HTMLElement.prototype[m];
    HTMLElement.prototype[m] = function (...a) {
      window.__log.push({ type: `call ${m}`, el: this.getAttribute("aria-label") || this.tagName, stack: new Error().stack.split("\n").slice(2, 5).map((s) => s.trim().slice(0, 90)) });
      return orig.apply(this, a);
    };
  }
  document.addEventListener("focusout", (e) => window.__log.push({ type: "focusout", el: e.target.getAttribute?.("aria-label") || e.target.tagName, to: e.relatedTarget?.getAttribute?.("aria-label") || e.relatedTarget?.tagName || null }), true);
  document.addEventListener("DOMContentLoaded", () => {
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.removedNodes) if (n.nodeType === 1 && (n.matches?.("input") || n.querySelector?.("input"))) window.__log.push({ type: "input removed from DOM" }); }).observe(document.body, { childList: true, subtree: true });
  });
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${base}/me`, { waitUntil: "networkidle" });
await page.waitForSelector(".wish-card");
await page.getByRole("button", { name: "メールで続ける" }).click();
const input = page.getByLabel("メールアドレス");
await page.waitForTimeout(500);
await input.tap?.().catch(() => {});
await input.click();
if (keyboard) await page.setViewportSize({ width: 390, height: 844 - 336 });
await page.evaluate(() => { window.__inp = document.querySelector('input[aria-label="メールアドレス"]'); window.__log.length = 0; });
let firstLoss = -1;
const text = "ayako@example.com";
for (let i = 0; i < text.length; i++) {
  await page.keyboard.type(text[i]);
  await page.waitForTimeout(refresh ? 400 : 120);
  const st = await page.evaluate(() => ({ same: document.querySelector('input[aria-label="メールアドレス"]') === window.__inp, focused: document.activeElement === window.__inp }));
  if ((!st.same || !st.focused) && firstLoss < 0) firstLoss = i + 1;
}
const log = await page.evaluate(() => window.__log);
console.log(`${engine}${keyboard ? " +キーボード" : ""}${refresh ? " +トークン更新" : ""}：`, firstLoss < 0 ? "最後まで、フォーカスが外れない" : `${firstLoss}文字目で、入力欄が作り直された/フォーカスが外れた`);
const interesting = log.filter((l) => l.type !== "call focus" || firstLoss >= 0);
if (firstLoss >= 0 || process.argv.includes("--verbose")) console.log(JSON.stringify(log.slice(0, 12), null, 1));
console.log("匿名ログインの回数（signup への通信）:", db.log.filter((l) => l === "signup").length, "／ セッション更新（token）:", db.log.filter((l) => l === "token").length);
console.log("pageerror:", errors.length ? errors : "なし", "／ ログ件数:", log.length);
await browser.close();
