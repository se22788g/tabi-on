// 390×844 の画面でスクリーンショットを撮る。使い方: node scripts/screenshots.mjs <保存先> [baseUrl]
import { chromium } from "playwright-core";

const out = process.argv[2] ?? "docs/screens/stage1";
const base = process.argv[3] ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ja-JP" });
const page = await ctx.newPage();
const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("saved", name);
};
const go = async (path) => {
  await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => {});
};

await go("/trips/new");
await shot("F1-start");
await page.getByRole("button", { name: "友人", exact: true }).click();
await page.getByPlaceholder("あなたの名前").fill("ちこ");
await page.getByPlaceholder("名前を入力").fill("あや");
await page.getByRole("button", { name: "追加" }).click();
await page.getByPlaceholder("名前を入力").fill("みさき");
await page.getByRole("button", { name: "追加" }).click();
await shot("F1-start-filled");
await go("/trips/demo/invite");
await shot("F2-invite");
await go("/j/TABI-4K7Q");
await shot("F3-join");
await go("/j");
await shot("F3-join-code-input");
await go("/trips/demo/q/1");
await shot("F4-q1-multi");
await go("/trips/demo/q/2");
await shot("F4-q2-scale");
await go("/trips/demo/q/12");
await shot("F4-q12-places");
await go("/trips/demo/intro");
await shot("F5-intro-loading");
await page.waitForTimeout(2200);
await shot("F5-intro-done");
await go("/trips/demo/rate");
await shot("F6-rate");
await page.getByRole("button", { name: /に含まれる場所を見る/ }).click();
await shot("F6-rate-sheet");
await page.keyboard.press("Escape");
for (let i = 0; i < 5; i++) {
  await page.getByRole("button", { name: "行きたい", exact: true }).click();
  if (i === 0) await shot("F6-rate-feedback");
  await page.waitForTimeout(600);
}
await shot("F6-rate-done");
await go("/trips");
await shot("M2-trips");
await go("/trips/demo/plan");
await shot("M3-plan");
await page.getByRole("button", { name: "蔵王の樹氷を見に行く" }).click();
await shot("M3-plan-detail");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "予定のメニュー" }).first().click();
await shot("M3-plan-menu");
await page.getByRole("button", { name: "ひとつ下へ" }).click();
await shot("M3-plan-reordered");
await page.getByRole("button", { name: "予定のメニュー" }).first().click();
await page.getByRole("button", { name: "この予定を外す" }).click();
await shot("M3-plan-removed");
await go("/spots/yamagata-ginzan-yukimi-buro");
await shot("M4-spot");
await go("/me");
await shot("M5-me");
await go("/me/tendency");
await shot("M6-tendency");
await go("/me/visited");
await shot("M7-visited");
await browser.close();
