// 入力欄に1文字ずつ打っても、フォーカスが外れない（キーボードが消えない）ことを確かめる。
// 使い方: （偽のURLを埋め込んだビルドを動かしたうえで）node scripts/check-input-focus.mjs [baseUrl]
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

/** 入力欄にフォーカスして、1文字ずつ打つ。1文字ごとに、フォーカスがまだその入力欄にあるか確かめる */
async function typeCheck(name, locator, text) {
  await locator.click();
  let lost = -1;
  let i = 0;
  for (const ch of text) {
    await page.keyboard.type(ch);
    i++;
    await page.waitForTimeout(60);
    const focused = await locator.evaluate((el) => document.activeElement === el);
    if (!focused && lost < 0) lost = i;
  }
  const value = await locator.inputValue();
  ok(`${name}：1文字ずつ打っても、フォーカスが外れない`, lost < 0 && value === text, lost >= 0 ? `${lost}文字目でフォーカスが外れた` : `入力した値 ${JSON.stringify(value)}`);
}

// マイページ：メールで続ける（BottomSheet の中）
await page.goto(`${base}/me`, { waitUntil: "networkidle" });
await page.waitForSelector(".wish-card");
await page.getByRole("button", { name: "メールで続ける" }).click();
await typeCheck("マイページ「メールで続ける」のメールアドレス", page.getByLabel("メールアドレス"), "ayako@example.com");
await page.keyboard.press("Escape");

// F2：人を追加（BottomSheet の中）
await page.goto(`${base}/trips/${T}/invite`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "人を追加" }).click();
await typeCheck("F2「人を追加」の名前", page.getByLabel("一緒に行く人の名前"), "ゆうこさん");
await page.keyboard.press("Escape");

// F1：あなたの名前・一緒に行く人
await page.goto(`${base}/trips/new`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "友人", exact: true }).click();
await typeCheck("F1 あなたの名前", page.getByLabel("あなたの名前"), "あやこ");
await typeCheck("F1 一緒に行く人の名前", page.getByLabel("一緒に行く人の名前"), "みさき");

// F3：コード入力、リストにない名前
await page.goto(`${base}/j`, { waitUntil: "networkidle" });
await typeCheck("F3 招待コード", page.getByLabel("招待コード"), "TABI-WXYZ");
await page.goto(`${base}/j/TABI-WXYZ`, { waitUntil: "networkidle" });
await page.waitForSelector(".round-choice");
await page.getByRole("button", { name: /リストにない/ }).click();
await typeCheck("F3 リストにない名前", page.getByLabel("あなたの名前"), "はなこ");

// F4 問12：場所の検索（そのまま追加）
await page.goto(`${base}/trips/${T}/q/12`, { waitUntil: "networkidle" });
await typeCheck("F4 問12 場所を検索", page.getByLabel("場所を検索"), "熊野古道へ行きたい");

await browser.close();
console.log(fail ? `${fail} 件 NG` : "すべて OK");
process.exit(fail ? 1 : 0);
