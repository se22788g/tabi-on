// 段階4の画面（M4〜M7）を、偽の Supabase のデータで通しで動かして、画面の実行時エラーと表示を確かめる。
// 使い方: （偽のURLを埋め込んだビルドを動かしたうえで）node scripts/smoke-stage4.mjs <保存先> [baseUrl]
import { chromium } from "playwright-core";
import { randomUUID } from "node:crypto";
import { createFakeDb, installFakeSupabase } from "./fake-supabase.mjs";

const out = process.argv[2] ?? "docs/screens/stage4";
const base = process.argv[3] ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
let fail = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "OK  " : "NG  "}${name}${!cond && extra ? `  ← ${extra}` : ""}`); if (!cond) fail++; };
const db = createFakeDb();
const errors = [];
const iso = (d = 0) => new Date(Date.now() - d * 86400000).toISOString();
const me = randomUUID();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ja-JP" });
await installFakeSupabase(ctx, db, { userId: me });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errors.push(m.text().slice(0, 200)));
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${out}/${name}.png` }); };
const ids = (p) => db.spots.filter((s) => s.id.startsWith(p)).map((s) => s.id);

// ---- 度合いがまだない人（初めて）：M5 は「いまが見頃」3件、まだ行けていない場所は空、傾向は空 ----
await page.goto(`${base}/me`, { waitUntil: "networkidle" });
await page.waitForSelector(".wish-card");
ok("M5：度合いがない人にも「いまが見頃」3件（AiBadgeなし）", (await page.locator(".wish-card").count()) === 3 && (await page.locator(".wish-card .ai-badge").count()) === 0);
ok("M5：「まだ行けていない場所」は空の文言", (await page.getByText("行きたい度合いを選ぶと、ここにたまっていきます。").count()) === 1);
ok("M5：アカウント欄が一番上", (await page.locator("main").innerText()).trimStart().startsWith("わ"));
await shot("M5-me-empty");
await page.goto(`${base}/me/tendency`, { waitUntil: "networkidle" });
await page.waitForSelector("h1");
ok("M6：回答も度合いもないとき", (await page.getByText("これまでの0件の行きたい度合いから").count()) === 1 && (await page.getByText("あと3回答えると見えてきます").count()) === 5);
await page.goto(`${base}/me/visited`, { waitUntil: "networkidle" });
await page.waitForSelector("main p");
ok("M7：0件の文言", (await page.getByText("行った場所を記録すると、おすすめがあなたに合っていきます。").count()) === 1);

// ---- データを入れる：2つの旅の回答と度合い ----
const trips = [randomUUID(), randomUUID(), randomUUID()];
const members = trips.map((t) => { const m = { id: randomUUID(), trip_id: t, name: "わたし", user_id: me, is_owner: true, answered_at: iso(30), rated_at: iso(30), seq: 1 }; db.members.push(m); return m; });
const wants = [["温泉・いやし", "自然・景色"], ["温泉・いやし"], ["温泉・いやし", "食べる"]];
members.forEach((m, i) => {
  db.answers.push({ member_id: m.id, question_id: "wants", value: wants[i] });
  db.answers.push({ member_id: m.id, question_id: "pace", value: [2, 3, 4][i] });
});
db.answers.push({ member_id: members[0].id, question_id: "budget", value: 5 });
const cand = (t, title, spots) => { const c = { id: randomUUID(), trip_id: t, title, area_label: "x", spot_ids: spots, tags: ["a", "b"], source: "rule", for_member_id: null, created_at: iso(30) }; db.candidates.push(c); return c; };
const c1 = cand(trips[0], "銀山温泉で、温泉と雪景色", ids("yamagata-ginzan").slice(0, 3));
const c2 = cand(trips[0], "蔵王で、雪景色と体験", ids("yamagata-zao").slice(0, 3));
const c3 = cand(trips[1], "渋温泉で、温泉と街歩き", ids("nagano-shibu").slice(0, 3));
const c4 = cand(trips[2], "宮島で、島と体験", ids("hiroshima-miyajima").slice(0, 3));
[[c1, members[0], 4, 5], [c2, members[0], 2, 4], [c3, members[1], 3, 2], [c4, members[2], 1, 1]].forEach(([c, m, level, ago]) => db.ratings.push({ member_id: m.id, candidate_id: c.id, level, created_at: iso(ago) }));
db.profiles.push({ id: me, display_name: "あや", origin: "東京都" });

// ---- M5 ----
await page.goto(`${base}/me`, { waitUntil: "networkidle" });
await page.waitForSelector(".wish-row");
const rows = await page.locator(".wish-row b").allInnerTexts();
const expected = [...ids("yamagata-ginzan").slice(0, 3), ...ids("nagano-shibu").slice(0, 3)].map((id) => db.spots.find((s) => s.id === id).name).sort();
ok("M5：まだ行けていない場所は「行きたい」以上（3以上）を選んだおすすめの場所だけ", JSON.stringify([...rows].sort()) === JSON.stringify(expected), rows.join("/"));
const names = await page.locator(".wish-row b").allInnerTexts();
ok("M5：新しい順（銀山=5日前より、渋=2日前の方が先）", names[0].includes("外湯") || db.spots.find((s) => s.name === names[0]).id.startsWith("nagano-shibu"), names[0]);
ok("M5：行に「東京から約…・日帰りから／1泊がおすすめ」", (await page.locator(".wish-row").first().innerText()).includes("東京から約"));
ok("M5：アカウント欄に名前", (await page.locator("main").innerText()).trimStart().startsWith("あ"));
ok("M5：おすすめカードは、行きたい場所を避ける", await (async () => {
  const cards = await page.locator(".wish-card h2").allInnerTexts();
  return cards.length === 3 && cards.every((t) => !expected.includes(t));
})());
await shot("M5-me");

// ---- M6 ----
await page.goto(`${base}/me/tendency`, { waitUntil: "networkidle" });
await page.waitForSelector("h1");
const h1 = (await page.locator("h1").innerText()).replace(/\s/g, "");
ok("M6：ひとこと（ルール版）と、AiBadgeなし", /^.+と.+に、心が動くみたい。$/.test(h1) && (await page.locator(".ai-badge").count()) === 0, h1);
ok("M6：これまでの4件の度合い", (await page.getByText("これまでの4件の行きたい度合いから").count()) === 1);
const chips = await page.locator(".trend-chips span").allInnerTexts();
ok("M6：したいこと（選んだ回数順）", chips[0] === "温泉・いやし" && chips.length === 3, chips.join("/"));
ok("M6：温泉・いやしは3/3＝80%以上の色", (await page.locator(".trend-chips span").first().getAttribute("class")) === "tone-strong");
ok("M6：ペースは3回答（バランス派）、予算は「あと2回答えると」", (await page.getByText("バランス派").count()) === 1 && (await page.getByText("あと2回答えると見えてきます").count()) === 1);
await shot("M6-tendency");

// ---- M4 ----
await page.goto(`${base}/spots/${ids("yamagata-ginzan")[0]}`, { waitUntil: "networkidle" });
await page.waitForSelector("h1");
ok("M4：自分の行きたい度合い（銀山のおすすめに「すごく行きたい」＝4）", (await page.getByText("あなたの行きたい度合い：すごく行きたい").count()) === 1);
await shot("M4-spot");
await page.getByRole("button", { name: "行った", exact: true }).click();
await page.waitForSelector("text=また行きたい？");
ok("M4：行ったを押すと visits に入る", db.visits.some((v) => v.user_id === me && v.spot_id === ids("yamagata-ginzan")[0]));
const chip = (name) => page.getByRole("button", { name, exact: true });
const status = () => page.locator('p[role="status"]').last().innerText();
await chip("また行きたい").click();
await page.waitForTimeout(400);
ok("M4：また行きたいが保存される", db.visits.find((v) => v.spot_id === ids("yamagata-ginzan")[0]).again === true);
ok("M4：選んだチップが塗りつぶされ✓が付き、「『また行きたい』で記録しました」が出る", (await chip("また行きたい").getAttribute("class")).includes("chosen") && (await chip("また行きたい").locator("svg").count()) === 1 && (await chip("一度でいい").getAttribute("class")).includes("chosen") === false && (await status()) === "『また行きたい』で記録しました");
await shot("M4-spot-visited");
await chip("一度でいい").click();
await page.waitForTimeout(400);
ok("M4：選び直すと上書き（一度でいい）", db.visits[0].again === false && (await status()) === "『一度でいい』で記録しました" && (await chip("一度でいい").getAttribute("class")).includes("chosen"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("text=また行きたい？");
ok("M4：再読み込みしても、選んだ状態が残る", (await chip("一度でいい").getAttribute("class")).includes("chosen") && (await status()) === "『一度でいい』で記録しました");
db.failVisitsPatch = true;
await chip("また行きたい").click();
await page.waitForTimeout(500);
ok("M4：保存に失敗したら、選択は変わらず「記録できませんでした。もう一度ためしてください」が出る", db.visits[0].again === false && (await chip("一度でいい").getAttribute("class")).includes("chosen") && !(await chip("また行きたい").getAttribute("class")).includes("chosen") && (await status()) === "記録できませんでした。もう一度ためしてください");
await shot("M4-spot-visited-error");
db.failVisitsPatch = false;
await chip("一度でいい").click();
await page.waitForTimeout(400);
ok("M4：同じほうをもう一度押すと選択を外し、「記録をはずしました」が出る", db.visits[0].again === null && (await status()) === "記録をはずしました" && !(await chip("一度でいい").getAttribute("class")).includes("chosen"));
await chip("また行きたい").click();
await page.waitForTimeout(400);
await page.goto(`${base}/spots/does-not-exist`, { waitUntil: "networkidle" });
ok("M4：ない場所は404", (await page.content()).includes("404") || (await page.getByText("This page could not be found").count()) > 0);

// ---- 行ったあとの M5 / M7 ----
await page.goto(`${base}/me`, { waitUntil: "networkidle" });
await page.waitForSelector(".wish-row");
const after = await page.locator(".wish-row b").allInnerTexts();
ok("M5：「行った」にした場所は、まだ行けていない場所から消える", !after.includes(db.spots.find((s) => s.id === ids("yamagata-ginzan")[0]).name) && after.length === expected.length - 1);
await page.goto(`${base}/me/visited`, { waitUntil: "networkidle" });
await page.waitForSelector(".visit-row");
ok("M7：行った場所が並び、また行きたいにハート", (await page.locator(".visit-row").count()) === 1 && (await page.locator('.visit-row [aria-label="また行きたい"]').count()) === 1);
await shot("M7-visited");
// 取り消し
await page.goto(`${base}/spots/${ids("yamagata-ginzan")[0]}`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "行った ✓" }).click();
await page.waitForTimeout(400);
ok("M4：もう一度押すと取り消せる", db.visits.length === 0);

// タブの強調（M4 は来た側）
await page.goto(`${base}/me`, { waitUntil: "networkidle" });
await page.locator('a[href^="/spots/"]').first().click().catch(() => {});
// ---- 段階6：アカウント登録（メールのみ）----
await page.goto(`${base}/me`, { waitUntil: "networkidle" });
await page.waitForSelector(".wish-card");
ok("M5：Google ログインのボタンはない。「メールで続ける」だけ", (await page.getByRole("button", { name: "Googleで続ける" }).count()) === 0 && (await page.getByRole("button", { name: "メールで続ける" }).count()) === 1);
await shot("M5-account");
await page.getByRole("button", { name: "メールで続ける" }).click();
await page.getByLabel("メールアドレス").fill("あいうえお");
await page.getByRole("button", { name: "送る", exact: true }).click();
ok("アカウント：形が違うメールは、送らずに文を出す", (await page.getByText("メールアドレスを確かめてください").isVisible()) && !db.log.some((l) => l.startsWith("updateUser")));
await page.getByLabel("メールアドレス").fill("ayako@example.com");
await page.getByRole("button", { name: "送る", exact: true }).click();
await page.waitForSelector("text=確認メールを送りました。");
ok("アカウント：新しいメールは、いまの記録に紐づける確認メール（updateUser）を送る", db.log.includes("updateUser ayako@example.com") && !db.log.some((l) => l.startsWith("otp")));
await shot("M5-account-sent");
await page.keyboard.press("Escape");
// すでにあるメール：ログイン用のリンク（signInWithOtp、新しいアカウントは作らない）
db.takenEmails = ["taken@example.com"];
await page.getByRole("button", { name: "メールで続ける" }).click();
await page.getByLabel("メールアドレス").fill("taken@example.com");
await page.getByRole("button", { name: "送る", exact: true }).click();
await page.waitForSelector("text=ログイン用のリンクを送りました。");
ok("アカウント：すでにあるメールには、ログイン用のリンクを送る（shouldCreateUser=false）", db.log.includes("otp taken@example.com") && db.otpBody.create_user === false);
await page.keyboard.press("Escape");
// 失敗
db.failUpdateUser = true;
await page.getByRole("button", { name: "メールで続ける" }).click();
await page.getByLabel("メールアドレス").fill("fail@example.com");
await page.getByRole("button", { name: "送る", exact: true }).click();
await page.waitForSelector("text=送れませんでした。もう一度ためしてください");
ok("アカウント：失敗したら文を出す", true);
db.failUpdateUser = false;
await page.keyboard.press("Escape");
// アカウントがあるとき：メールアドレスとログアウト
db.account = { email: "ayako@example.com" };
await page.goto(`${base}/me?account=confirmed`, { waitUntil: "networkidle" });
await page.waitForSelector(".wish-card");
ok("M5：アカウントがあれば、メールアドレスと「ログアウト」。作るボタンは出ない", (await page.getByText("ayako@example.com").isVisible()) && (await page.getByRole("button", { name: "ログアウト" }).isVisible()) && (await page.getByRole("button", { name: "メールで続ける" }).count()) === 0);
ok("M5：メールのリンクから戻ったときの文", await page.getByText("アカウントができました。").isVisible());
await shot("M5-account-done");
await page.goto(`${base}/me?account=failed`, { waitUntil: "networkidle" });
ok("M5：リンクが使えなかったときの文", await page.getByText("確認できませんでした。もう一度ためしてください").isVisible());
await page.getByRole("button", { name: "ログアウト" }).click();
await page.waitForURL(/\/me$/);
await page.waitForSelector(".wish-card");
ok("M5：ログアウトすると、メールで続ける状態に戻る", (await page.getByRole("button", { name: "メールで続ける" }).count()) === 1);
db.account = null;

ok("画面の実行時エラーがない", errors.length === 0, errors.slice(0, 3).join(" / "));
await browser.close();
console.log(fail ? `${fail} 件 NG` : "すべて OK");
process.exit(fail ? 1 : 0);
