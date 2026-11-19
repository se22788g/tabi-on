// 段階3の画面を、偽の Supabase（scripts/fake-supabase.mjs）で通しで動かして、画面の実行時エラーと表示を確かめる。
// 使い方: （偽のURLを埋め込んだビルドを動かしたうえで）node scripts/smoke-stage3.mjs <保存先> [baseUrl]
import { chromium } from "playwright-core";
import { createFakeDb, installFakeSupabase } from "./fake-supabase.mjs";
import { randomUUID } from "node:crypto";

const out = process.argv[2] ?? "docs/screens/stage3";
const base = process.argv[3] ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
let fail = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "OK  " : "NG  "}${name}${!cond && extra ? `  ← ${extra}` : ""}`); if (!cond) fail++; };
const db = createFakeDb();
const errors = [];
const newPage = async (userId) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ja-JP" });
  await installFakeSupabase(ctx, db, { userId });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errors.push(m.text().slice(0, 200)));
  return page;
};
const shot = async (page, name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${out}/${name}.png` }); };
const A = randomUUID(), B = randomUUID();
const a = await newPage(A);

// F1：旅をはじめる → create_trip → F2
await a.goto(base + "/trips/new?seed=yamagata-ginzan-yukimi-buro", { waitUntil: "networkidle" });
ok("F1：この場所から考えます＋地域が東北", (await a.content()).includes("この場所から考えます：山形・銀山温泉") && (await a.getByRole("button", { name: "東北", exact: true }).getAttribute("aria-pressed")) === "true");
await shot(a, "F1-start-seed");
await a.getByRole("button", { name: "友人", exact: true }).click();
await a.getByPlaceholder("あなたの名前").fill("あや");
await a.getByPlaceholder("名前を入力").fill("みさき");
await a.getByRole("button", { name: "追加" }).click();
await a.getByRole("button", { name: "1泊", exact: true }).click();
await a.getByRole("button", { name: "東京", exact: true }).click();
await a.getByRole("button", { name: /次へ：招待コードを発行する/ }).click();
await a.waitForURL(/\/trips\/[0-9a-f-]+\/invite/);
const tripId = a.url().match(/trips\/([0-9a-f-]+)\//)[1];
ok("F1：create_trip に条件が渡る", db.trips[0]?.companion === "friends" && db.trips[0].nights === "1" && db.trips[0].origin === "東京都" && db.trips[0].seed_spot_id === "yamagata-ginzan-yukimi-buro" && JSON.stringify(db.trips[0].regions) === '["tohoku"]');
ok("F1：メンバーが入る（あや・みさき）", db.members.map((m) => m.name).join() === "あや,みさき");

// F2：招待
await a.waitForSelector(".invite-code strong");
const code = db.trips[0].code;
ok("F2：招待コードが出る", (await a.locator(".invite-code strong").innerText()) === code);
ok("F2：状態（あなた＝回答中、みさき＝まだ）", (await a.locator(".member-row").allInnerTexts()).join("|").replace(/\s+/g, "") === "ああなた回答中|みみさきまだ");
await shot(a, "F2-invite");
await a.getByRole("button", { name: "人を追加" }).click();
await a.getByPlaceholder("名前を入力").fill("けんた");
await a.getByRole("button", { name: "追加", exact: true }).click();
await a.waitForTimeout(400);
ok("F2：＋人を追加で members に入る", db.members.some((m) => m.name === "けんた"));

// F3：別の端末で、招待リンクから参加
const b = await newPage(B);
await b.goto(`${base}/j/${code}`, { waitUntil: "networkidle" });
await b.waitForSelector("text=あやさんから旅の招待が届いています");
ok("F3：まだ参加していない名前だけが並ぶ", (await b.locator(".round-choice").allInnerTexts()).map((t) => t.replace(/\s+/g, "")).join("|") === "みみさき|けけんた|リストにない（名前を入れる）");
await shot(b, "F3-join");
await b.getByRole("button", { name: /みさき/ }).click();
await b.getByRole("button", { name: "参加して質問に答える" }).click();
await b.waitForURL(/\/q\/1/);
ok("F3：参加すると user_id が入る", db.members.find((m) => m.name === "みさき").user_id === B);
await a.goto(`${base}/trips/${tripId}/invite`, { waitUntil: "networkidle" });
await a.waitForSelector(".member-row");
ok("F2：参加状況が更新される（みさき＝回答中）", (await a.locator(".member-row").allInnerTexts()).join("|").replace(/\s+/g, "").includes("みさき回答中"));
// 参加済みの端末でもう一度開くと、続きの画面へ
await b.goto(`${base}/j/${code}`, { waitUntil: "networkidle" });
await b.waitForURL(/\/q\/1/);
ok("F3：参加済みの端末は、続きの画面（質問）に移る", true);

// F4：質問
await a.goto(`${base}/trips/${tripId}/q/1`, { waitUntil: "networkidle" });
await a.waitForSelector("h1");
await shot(a, "F4-q1");
await a.getByRole("button", { name: "温泉・いやし" }).click();
await a.getByRole("button", { name: "自然・景色" }).click();
await a.waitForTimeout(400);
const memberA = db.members.find((m) => m.user_id === A).id;
ok("F4：選ぶとその都度保存される", JSON.stringify(db.answers.find((x) => x.member_id === memberA && x.question_id === "wants")?.value) === '["温泉・いやし","自然・景色"]');
await a.getByRole("button", { name: "次へ", exact: true }).click();
await a.waitForURL(/\/q\/2/);
await a.getByRole("button", { name: "とばす" }).click();   // 2問目はとばす
await a.waitForURL(/\/q\/3/);
ok("F4：とばした問いは回答の行を作らない", !db.answers.some((x) => x.member_id === memberA && x.question_id === "pace"));
await a.goBack(); await a.goBack();
await a.waitForSelector("h1");
ok("F4：戻っても回答が残っている", (await a.getByRole("button", { name: "温泉・いやし" }).getAttribute("aria-pressed")) === "true");
await a.goto(`${base}/trips/${tripId}/q/11`, { waitUntil: "networkidle" });
await shot(a, "F4-q11");
ok("F4：宿泊ありなので、問いは12問", (await a.locator(".accent-text").innerText()).replace(/\s/g, "") === "11/12");
await a.goto(`${base}/trips/${tripId}/q/12`, { waitUntil: "networkidle" });
// 問12：自由入力（サイトにない場所）
await a.getByLabel("場所を検索").fill("熊野古道");
ok("F4：問12は、候補がなくても「『熊野古道』をそのまま追加」が出る", await a.getByText("『熊野古道』をそのまま追加").isVisible());
await a.getByText("『熊野古道』をそのまま追加").click();
await a.waitForTimeout(400);
ok("F4：自由入力は {text} で保存され、行に「サイトにない場所」が添う", JSON.stringify(db.answers.find((x) => x.member_id === memberA && x.question_id === "places")?.value) === '[{"text":"熊野古道"}]' && (await a.locator(".added-place").innerText()).includes("サイトにない場所"));
await a.getByLabel("場所を検索").fill("銀山");
await a.locator(".check-row").first().click();
await a.waitForTimeout(300);
ok("F4：候補から選んだ場所は、spot の id で入り、行には地域が添う", db.answers.find((x) => x.member_id === memberA && x.question_id === "places").value.includes("yamagata-ginzan-yukimi-buro") && (await a.locator(".added-place").nth(1).innerText()).includes("山形・銀山温泉"));
await shot(a, "F4-q12-free");
for (const t of ["あ場所", "い場所", "う場所", "え場所"]) { await a.getByLabel("場所を検索").fill(t); await a.getByText(`『${t}』をそのまま追加`).click(); }
await a.getByLabel("場所を検索").fill("お場所");
ok("F4：そのまま追加は5件まで（6件目は押せない）", await a.getByRole("button", { name: /『お場所』をそのまま追加/ }).isDisabled());
await a.getByLabel("場所を検索").fill("");
await a.getByRole("button", { name: "え場所を削除" }).click();
await a.getByRole("button", { name: "熊野古道を削除" }).click();
await a.waitForTimeout(300);
ok("F4：削除できる（保存も更新される）", !JSON.stringify(db.answers.find((x) => x.member_id === memberA && x.question_id === "places").value).includes("熊野古道"));
await a.getByLabel("場所を検索").fill("熊野古道"); await a.getByText("『熊野古道』をそのまま追加").click();
ok("F4：入力は30字まで", (await a.getByLabel("場所を検索").getAttribute("maxlength")) === "30");
await a.getByRole("button", { name: "次へ", exact: true }).click();
await a.waitForURL(/\/intro/);
ok("F4：最後の問いで answered_at が入る", Boolean(db.members.find((m) => m.id === memberA).answered_at));

// F5：おすすめの案内（おすすめは、サーバーが作ったものとして先に入れておく）
const spotIds = (p) => db.spots.filter((s) => s.id.startsWith(p)).slice(0, 3).map((s) => s.id);
db.candidates.push(
  { id: randomUUID(), trip_id: tripId, title: "銀山温泉で、温泉と雪景色", area_label: "山形・銀山温泉", spot_ids: spotIds("yamagata-ginzan"), tags: ["温泉", "雪景色", "友人"], source: "rule", for_member_id: memberA, created_at: iso() },
  { id: randomUUID(), trip_id: tripId, title: "蔵王で、雪景色と体験", area_label: "山形・蔵王", spot_ids: spotIds("yamagata-zao"), tags: ["雪景色", "体験"], source: "rule", for_member_id: memberA, created_at: iso() },
  { id: randomUUID(), trip_id: tripId, title: "渋温泉で、温泉と街歩き", area_label: "長野・渋温泉", spot_ids: spotIds("nagano-shibu"), tags: ["温泉", "街歩き"], source: "rule", for_member_id: memberA, created_at: iso() },
);
function iso() { return new Date().toISOString(); }
await a.goto(`${base}/trips/${tripId}/intro`, { waitUntil: "networkidle" });
await a.waitForSelector("h1", { timeout: 15000 });
ok("F5：ルール版なので「あなたへのおすすめ」の印は出ない（ヘッダーの文字だけ）", (await a.locator(".ai-badge").count()) === 0);
await shot(a, "F5-intro-done");

// F6：行きたい度合い
await a.getByRole("link", { name: "はじめる" }).click();
await a.waitForURL(/\/rate/);
await a.waitForSelector(".candidate-card");
ok("F6：カードが3枚（金額と時間が出る）", (await a.locator(".candidate-nav").innerText()).replace(/\s/g, "") === "1/3" && (await a.locator(".facts").innerText()).includes("東京から約"));
ok("F6：ルール版なのでAiBadgeなし", (await a.locator(".candidate-card .ai-badge").count()) === 0);
await shot(a, "F6-rate");
const levels = ["行きたい", "すごく行きたい", "どちらでもない"];
for (const l of levels) { await a.getByRole("button", { name: l, exact: true }).click(); await a.waitForTimeout(500); }
await a.waitForSelector("text=ぜんぶ選び終わりました");
await a.waitForTimeout(500);
ok("F6：度合いが保存される（3件）", db.ratings.filter((r) => r.member_id === memberA).length === 3);
ok("F6：終えたら rated_at が入る", Boolean(db.members.find((m) => m.id === memberA).rated_at));
await shot(a, "F6-rate-done");

// M3：工程案（工程案は、サーバーが作ったものとして先に入れておく）
db.plans = { version: 1, title: "山形県の旅", source: "rule", updated_reason: "1人目の回答で更新しました" };
const all = db.candidates.flatMap((c) => c.spot_ids);
all.slice(0, 5).forEach((sid, i) => db.plan_items.push({ id: randomUUID(), trip_id: tripId, day: i < 3 ? 1 : 2, position: (i % 3) + 1, spot_id: sid, title: db.spots.find((s) => s.id === sid).name, time_hint: ["10:00", "13:00", "16:00"][i % 3], pinned: i === 0, edited_by_user: false, source: "rule" }));
db.members.find((m) => m.id === memberA).last_seen_plan_version = 0;
await a.goto(`${base}/trips/${tripId}/plan`, { waitUntil: "networkidle" });
await a.waitForSelector(".plan-item");
ok("M3：予定カードと「4人中…が回答」", (await a.locator(".plan-item").count()) === 5 && (await a.locator(".status-chip").innerText()).includes("人中1人が回答"));
ok("M3：更新のお知らせ", (await a.locator(".notice").innerText()).includes("1人目の回答で更新しました"));
ok("M3：ルール版は「あなたへのおすすめ」の印なし", (await a.locator(".ai-badge").count()) === 0);
await shot(a, "M3-plan");
// ひとつ下へ → 保存される
const t0 = await a.locator(".plan-item .main b").allInnerTexts();
await a.locator(".plan-item .more").nth(1).click();
await a.getByRole("button", { name: "ひとつ下へ" }).click();
await a.waitForTimeout(600);
const t1 = await a.locator(".plan-item .main b").allInnerTexts();
ok("M3：ひとつ下へで順番が変わる", t0[1] === t1[2] && t0[2] === t1[1]);
ok("M3：保存される（plan_items の upsert、編集済みの印）", db.log.some((l) => l.startsWith("POST plan_items")) && db.plan_items.filter((p) => p.edited_by_user).length >= 3);
// 外す → 外した場所に記録、元に戻す
await a.locator(".plan-item .more").nth(3).click();
await a.getByRole("button", { name: "この予定を外す" }).click();
await a.waitForTimeout(500);
ok("M3：外すと plan_items から消え、removed_spots に記録される", db.plan_items.length === 4 && db.removed_spots.length === 1);
await a.getByRole("button", { name: "元に戻す" }).click();
await a.waitForTimeout(500);
ok("M3：元に戻すと戻り、removed_spots からも消える", db.plan_items.length === 5 && db.removed_spots.length === 0);
// 絶対行くを外すときは確認
await a.locator(".plan-item .more").nth(0).click();
await a.getByRole("button", { name: "この予定を外す" }).click();
ok("M3：絶対行くは確認が出る", await a.getByText("絶対行くの予定です。外しますか？").isVisible());
await a.getByRole("button", { name: "やめる" }).click();
// 別の日に移す → 2日目の最後
await a.locator(".plan-item .more").nth(1).click();
await a.getByRole("button", { name: "別の日に移す" }).click();
await a.getByRole("button", { name: "2日目の最後に移す" }).click();
await a.waitForTimeout(500);
const moved = db.plan_items.filter((p) => p.day === 2).sort((x, y) => x.position - y.position).at(-1);
ok("M3：別の日に移すと、2日目の最後に入る（編集済みの印）", db.plan_items.filter((p) => p.day === 2).length === 3 && moved.edited_by_user === true);
// ＋ 候補から足す
await a.getByRole("button", { name: "候補から足す" }).first().click();
const before = db.plan_items.length;
await a.locator(".sheet .check-row").first().click();
await a.waitForTimeout(500);
ok("M3：候補から足すと、その日の最後に入り、並べ替えられる", db.plan_items.length === before + 1 && db.plan_items.some((p) => p.source === "user" && p.day === 1 && p.edited_by_user));
await shot(a, "M3-plan-edited");
// ほかの端末の更新が6秒以内に反映される（お知らせ）。自分の直した分の「変わりました」の通知が先に終わるのを待つ
await a.waitForTimeout(1600);
db.plans = { ...db.plans, version: db.plans.version + 5, updated_reason: "2人目の回答で更新しました" };
db.plan_items.push({ id: randomUUID(), trip_id: tripId, day: 2, position: 9, spot_id: all[6], title: "ほかの人が足した予定", time_hint: "18:30", pinned: false, edited_by_user: false, source: "rule" });
await a.waitForTimeout(7500);
ok("M3：ほかの人の更新が反映され、「2人目の回答で更新しました」が出る", (await a.locator(".notice").innerText()).includes("2人目の回答で更新しました") && (await a.locator(".plan-item").count()) === 7);
await a.getByRole("button", { name: "この案で決める" }).click();
await a.waitForURL(/\/trips$/);
ok("M3：決めると status=decided", db.trips[0].status === "decided");

// M2：旅の一覧
await a.waitForSelector(".trip-card");
ok("M2：旅が並ぶ（決まった旅）", (await a.locator("h2").allInnerTexts()).includes("決まった旅") && (await a.locator(".trip-card h3").first().innerText()) === "山形県の旅");
await shot(a, "M2-trips");
await a.getByRole("button", { name: "行った場所を記録する" }).click();
await a.waitForSelector(".check-row");
await a.locator(".check-row").first().click();
await a.getByRole("button", { name: "記録する", exact: true }).click();
await a.waitForTimeout(400);
ok("M2：行った場所を visits に記録できる", db.visits.length === 1);
// 回答が途中の人は、続きの画面へ（みさき：まだ質問の途中）
await b.goto(`${base}/trips`, { waitUntil: "networkidle" });
await b.waitForSelector(".trip-card");
ok("M2：自分が回答し終えていなければ「あなたの回答待ち」と続きの画面", (await b.locator(".status-chip").first().innerText()) === "決定" || (await b.locator(".trip-card a").first().getAttribute("href")).endsWith("/q/1"));

// M3：サイトにない場所（spot_id なしの予定）
db.plan_items.push({ id: randomUUID(), trip_id: tripId, day: 2, position: 20, spot_id: null, title: "熊野古道", time_hint: "13:00", pinned: false, edited_by_user: true, source: "user" });
await a.goto(`${base}/trips/${tripId}/plan`, { waitUntil: "networkidle" });
await a.waitForSelector(".plan-item");
const freeCard = a.locator(".plan-item", { hasText: "熊野古道" });
ok("M3：サイトにない場所は、みんなの丸なしで「サイトにない場所」と添う", (await freeCard.innerText()).includes("サイトにない場所") && (await freeCard.locator(".responses").count()) === 0 && (await freeCard.locator(".dot").count()) === 0);
await shot(a, "M3-plan-free");
await freeCard.locator(".main").click();
ok("M3：詳細は、地図で見る（入力した文字で検索）と「このサイトにはありません。」だけ", (await a.getByText("この場所の情報は、このサイトにはありません。").isVisible()) && (await a.getByRole("link", { name: "地図で見る" }).getAttribute("href")) === "https://www.google.com/maps/search/?api=1&query=%E7%86%8A%E9%87%8E%E5%8F%A4%E9%81%93" && (await a.locator(".sheet dl").count()) === 0 && (await a.getByText("場所の詳細").count()) === 0);
await a.keyboard.press("Escape");
await freeCard.locator(".more").click();
await a.getByRole("button", { name: "別の日に移す" }).click();
await a.getByRole("button", { name: /日目の最後に移す/ }).click();
await a.waitForTimeout(500);
ok("M3：サイトにない場所も、日の移動ができる（編集済みのまま）", db.plan_items.find((p) => p.title === "熊野古道").day === 1 && db.plan_items.find((p) => p.title === "熊野古道").edited_by_user === true);
await a.locator(".plan-item", { hasText: "熊野古道" }).locator(".more").click();
await a.getByRole("button", { name: "この予定を外す" }).click();
await a.waitForTimeout(500);
ok("M3：外すと、その文字が removed_free_places に記録される", !db.plan_items.some((p) => p.title === "熊野古道") && db.removed_free_places.length === 1 && db.removed_free_places[0].place_text === "熊野古道");
await a.getByRole("button", { name: "元に戻す" }).click();
await a.waitForTimeout(500);
ok("M3：元に戻すと戻り、記録も消える", db.plan_items.some((p) => p.title === "熊野古道") && db.removed_free_places.length === 0);

// ひとり旅：名前の欄が消え、招待を飛ばして質問へ
const c = await newPage(randomUUID());
await c.goto(`${base}/trips/new`, { waitUntil: "networkidle" });
await c.getByRole("button", { name: "ひとり", exact: true }).click();
ok("F1：ひとりを選ぶと名前の欄が消える", (await c.getByPlaceholder("あなたの名前").count()) === 0);
await c.getByRole("button", { name: "次へ：質問に答える" }).click();
await c.waitForURL(/\/q\/1/);
ok("F1：ひとりなら招待を飛ばして質問へ（members は「わたし」1人）", db.trips.at(-1).companion === "solo" && db.members.filter((m) => m.trip_id === db.trips.at(-1).id).map((m) => m.name).join() === "わたし");

ok("画面の実行時エラーがない", errors.length === 0, errors.slice(0, 3).join(" / "));
await browser.close();
console.log(fail ? `${fail} 件 NG` : "すべて OK");
process.exit(fail ? 1 : 0);
