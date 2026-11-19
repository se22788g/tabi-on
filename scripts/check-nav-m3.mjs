// 段階1の修正の確認：タブ2つ、/ → /trips、/home なし、M3 の並べ替え・移動・削除・元に戻す
import { chromium } from "playwright-core";
const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
let fail = 0;
const ok = (name, cond, extra = "") => { console.log(cond ? "OK  " : "NG  ", name, extra); if (!cond) fail++; };
const go = (p) => page.goto(base + p, { waitUntil: "networkidle" });
const tabs = async () => { await page.waitForSelector(".tab-bar a"); return page.$$eval(".tab-bar a", (a) => a.map((x) => ({ t: x.textContent.trim(), cur: x.getAttribute("aria-current") }))); };
const titles = () => page.$$eval(".plan-item .main b", (b) => b.map((x) => x.textContent));

await go("/");
ok("/ → /trips", new URL(page.url()).pathname === "/trips");
ok("/home は 404", (await page.goto(base + "/home")).status() === 404);
await go("/trips");
let t = await tabs();
ok("タブは2つ（旅・マイページ）", t.length === 2 && t[0].t === "旅" && t[1].t === "マイページ", JSON.stringify(t));
ok("/trips は旅が強調", t[0].cur === "page" && !t[1].cur);
await go("/me");
t = await tabs();
ok("/me はマイページが強調", t[1].cur === "page" && !t[0].cur);
const heads = await page.$$eval("main h1, main h2, main b", (e) => e.map((x) => x.textContent.trim()));
const idx = (s) => heads.findIndex((h) => h.startsWith(s));
ok("マイページの順 1<2<3<4", idx("次は、誰とどこへ") < idx("まだ行けていない場所") && idx("まだ行けていない場所") < idx("あなたの旅の傾向") && idx("あなたの旅の傾向") < idx("行った場所"));
ok("アカウント欄が一番上", (await page.locator("main").innerText()).trimStart().startsWith("わ"));
ok("「あなたへのおすすめ」あり・「AIのおすすめ」なし", (await page.content()).includes("あなたへのおすすめ") && !(await page.content()).includes("AIのおすすめ"));
await page.click('a:has-text("あなたの旅の傾向")');
await page.waitForURL("**/me/tendency");
t = await tabs();
ok("M6 はマイページ強調", t[1].cur === "page");
// M4 は来た側
await go("/me");
await page.locator('a[href^="/spots/"]').first().click();
await page.waitForURL("**/spots/**");
await page.waitForTimeout(300);
t = await tabs();
ok("M5→M4 はマイページ強調", t[1].cur === "page", JSON.stringify(t));
await go("/trips/demo/plan");
t = await tabs();
ok("M3 は旅が強調", t[0].cur === "page");
// F1 の × は M2
await go("/trips/new");
ok("F1 × → /trips", (await page.getAttribute('a[aria-label="閉じる"]', "href")) === "/trips");

// M3
await go("/trips/demo/plan");
await page.waitForTimeout(500);
const first = await titles();
ok("つまみが全予定にあり44px以上", (await page.$$eval(".plan-item .grip", (g) => g.length >= 5 && g.every((x) => x.getBoundingClientRect().width >= 44 && x.getBoundingClientRect().height >= 44))));
const open = async (i) => { await page.locator(".plan-item .more").nth(i).click(); };
await open(0);
ok("先頭では「ひとつ上へ」が押せない", await page.getByRole("button", { name: "ひとつ上へ" }).isDisabled());
await page.getByRole("button", { name: "ひとつ下へ" }).click();
let now = await titles();
ok("ひとつ下へ", now[0] === first[1] && now[1] === first[0], now.join("/"));
const times = await page.$$eval(".plan-item .main .sub", (e) => e.slice(0, 3).map((x) => x.textContent.slice(0, 6)));
ok("時刻は早い順に振り直し", [...times].sort().join() === times.join(), times.join());
await open(2);
ok("日の最後では「ひとつ下へ」が押せない", await page.getByRole("button", { name: "ひとつ下へ" }).isDisabled());
await page.keyboard.press("Escape");
// 別の日に移す
await open(0);
await page.getByRole("button", { name: "別の日に移す" }).click();
await page.getByRole("button", { name: "2日目の最後に移す" }).click();
now = await titles();
ok("別の日に移す（2日目の最後）", now.length === 5 && now[now.length - 1] === first[1], now.join("/"));
// 外す→元に戻す（0番目は絶対行くなので1番目）
await open(1);
await page.getByRole("button", { name: "この予定を外す" }).click();
ok("外すと「予定を外しました」", await page.getByText("予定を外しました").isVisible());
ok("絶対行くでなければ確認なし", (await page.getByText("絶対行くの予定です。外しますか？").count()) === 0);
await page.getByRole("button", { name: "元に戻す" }).click();
ok("元に戻す", (await titles()).length === 5);
await page.waitForTimeout(300);
// 絶対行くは確認
const pinnedIdx = await page.$$eval(".plan-item", (e) => e.findIndex((x) => x.classList.contains("pinned")));
await open(pinnedIdx);
await page.getByRole("button", { name: "この予定を外す" }).click();
ok("絶対行くは確認の表示", await page.getByText("絶対行くの予定です。外しますか？").isVisible());
await page.getByRole("button", { name: "やめる" }).click();
ok("やめると残る", (await titles()).length === 5);
await open(pinnedIdx);
await page.getByRole("button", { name: "この予定を外す" }).click();
await page.getByRole("button", { name: "外す", exact: true }).click();
ok("外すで消える", (await titles()).length === 4);
await page.waitForTimeout(5400);
ok("5秒で「元に戻す」が消える", (await page.getByText("予定を外しました").count()) === 0);
// ドラッグ
await go("/trips/demo/plan");
await page.waitForTimeout(500);
const before = await titles();
const g = await page.locator(".plan-item .grip").nth(0).boundingBox();
await page.mouse.move(g.x + 22, g.y + 22);
await page.mouse.down();
for (let i = 1; i <= 14; i++) await page.mouse.move(g.x + 22, g.y + 22 + i * 12, { steps: 2 });
await page.mouse.up();
await page.waitForTimeout(400);
const after = await titles();
ok("ドラッグで順番が変わる", after.join() !== before.join(), after.join("/"));
await browser.close();
console.log(fail ? `${fail} 件失敗` : "すべて OK");
process.exit(fail ? 1 : 0);
