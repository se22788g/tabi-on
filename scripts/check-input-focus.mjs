// 入力欄に1文字ずつ打っても、フォーカスが外れない（キーボードが消えない）ことを確かめる。
// Chrome（パソコン）と、WebKit（iPhone の Safari と同じ描画エンジン。iPhone 14 の画面・タッチ操作・キーボードで画面の高さが縮む状態・
// 匿名ログインのセッションが実際に更新される状態）の両方で動かす。
// 使い方: （偽のURLを埋め込んだビルドを動かしたうえで）node scripts/check-input-focus.mjs [baseUrl] [--chromium-only|--webkit-only]
//   WebKit が入っていないときは、npx playwright-core install webkit
import { chromium, webkit, devices } from "playwright-core";
import { installFakeSupabase } from "./fake-supabase.mjs";
import { makeFixture } from "./fake-fixtures.mjs";

const base = process.argv.find((a) => /^https?:/.test(a)) ?? "http://localhost:3000";
const only = process.argv.includes("--webkit-only") ? "webkit" : process.argv.includes("--chromium-only") ? "chromium" : null;
let fail = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "OK  " : "NG  "}${name}${!cond && extra ? `  ← ${extra}` : ""}`); if (!cond) fail++; };

const KEYBOARD = 336; // iPhone のキーボードの高さの目安

async function runEngine(label, launch, contextOptions, { touch, shrinkForKeyboard, shortSession }) {
  const { db, me, T } = makeFixture();
  // 匿名ログインのセッションを短くして、入力している間にも、実際にトークンの更新が起きるようにする
  if (shortSession) db.sessionSeconds = 6;
  const browser = await launch();
  const ctx = await browser.newContext(contextOptions);
  await installFakeSupabase(ctx, db, { userId: me });
  const page = await ctx.newPage();
  const baseSize = page.viewportSize();
  // WebKit では、Next のリンクの先読み（?_rsc=）の通信が終わらず、networkidle にならないことがあるので、load のあと、画面ごとの目印を待つ
  const go = async (path, selector) => {
    await page.goto(`${base}${path}`, { waitUntil: "load" });
    await page.waitForSelector(selector, { timeout: 15000 });
  };

  /** 入力欄にフォーカスして、1文字ずつ打つ。1文字ごとに、フォーカスが同じ入力欄にあるか、入力欄が作り直されていないかを確かめる */
  async function typeCheck(name, locator, text) {
    await (touch ? locator.tap() : locator.click());
    if (shrinkForKeyboard) await page.setViewportSize({ width: baseSize.width, height: baseSize.height - KEYBOARD });
    await locator.evaluate((el) => { window.__input = el; });
    let lost = -1;
    let recreated = false;
    let i = 0;
    for (const ch of text) {
      await page.keyboard.type(ch);
      i++;
      await page.waitForTimeout(shortSession ? 350 : 60);
      const st = await page.evaluate(() => ({ focused: document.activeElement === window.__input, same: window.__input.isConnected }));
      if (!st.focused && lost < 0) lost = i;
      if (!st.same) recreated = true;
    }
    const value = await locator.inputValue().catch(() => null);
    if (shrinkForKeyboard) await page.setViewportSize(baseSize);
    ok(`[${label}] ${name}：1文字ずつ打っても、フォーカスが外れず、入力欄も作り直されない`, lost < 0 && !recreated && value === text, lost >= 0 ? `${lost}文字目でフォーカスが外れた` : recreated ? "入力欄が作り直された" : `入力した値 ${JSON.stringify(value)}`);
  }

  // マイページ：メールで続ける（BottomSheet の中）
  await go("/me", ".wish-card");
  await (touch ? page.getByRole("button", { name: "メールで続ける" }).tap() : page.getByRole("button", { name: "メールで続ける" }).click());
  await page.waitForTimeout(400);
  await typeCheck("マイページ「メールで続ける」のメールアドレス", page.getByLabel("メールアドレス"), "ayako@example.com");
  await page.keyboard.press("Escape");

  // F2：人を追加（BottomSheet の中）
  await go(`/trips/${T}/invite`, ".invite-code");
  await (touch ? page.getByRole("button", { name: "人を追加" }).tap() : page.getByRole("button", { name: "人を追加" }).click());
  await page.waitForTimeout(400);
  await typeCheck("F2「人を追加」の名前", page.getByLabel("一緒に行く人の名前"), "ゆうこさん");
  await page.keyboard.press("Escape");

  // F1：あなたの名前・一緒に行く人
  await go("/trips/new", "h1");
  await (touch ? page.getByRole("button", { name: "友人", exact: true }).tap() : page.getByRole("button", { name: "友人", exact: true }).click());
  await typeCheck("F1 あなたの名前", page.getByLabel("あなたの名前"), "あやこ");
  await typeCheck("F1 一緒に行く人の名前", page.getByLabel("一緒に行く人の名前"), "みさき");

  // F3：コード入力、リストにない名前
  await go("/j", 'input[aria-label="招待コード"]');
  await typeCheck("F3 招待コード", page.getByLabel("招待コード"), "TABI-WXYZ");
  await go("/j/TABI-WXYZ", ".round-choice");
  await (touch ? page.getByRole("button", { name: /リストにない/ }).tap() : page.getByRole("button", { name: /リストにない/ }).click());
  await typeCheck("F3 リストにない名前", page.getByLabel("あなたの名前"), "はなこ");

  // F4 問12：場所の検索（そのまま追加）
  await go(`/trips/${T}/q/12`, 'input[aria-label="場所を検索"]');
  await typeCheck("F4 問12 場所を検索", page.getByLabel("場所を検索"), "熊野古道へ行きたい");

  if (shortSession) ok(`[${label}] 入力している間に、匿名ログインのセッション更新（token）が実際に起きた`, db.log.includes("token"), "更新が起きていない");
  ok(`[${label}] 匿名ログインは、最初の1回だけ（二重に起きない）`, db.log.filter((l) => l === "signup").length === 1, `${db.log.filter((l) => l === "signup").length}回`);
  await browser.close();
}

const CHROME = () => chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
if (only !== "webkit") await runEngine("Chrome・パソコン", CHROME, { viewport: { width: 390, height: 844 } }, { touch: false, shrinkForKeyboard: false, shortSession: false });
if (only !== "chromium") {
  try {
    await runEngine("WebKit・iPhone 14（タッチ・キーボード・セッション更新）", () => webkit.launch(), { ...devices["iPhone 14"], locale: "ja-JP" }, { touch: true, shrinkForKeyboard: true, shortSession: true });
  } catch (e) {
    if (/Executable doesn't exist|browserType\.launch/.test(String(e))) {
      console.log("NG  WebKit が入っていません。npx playwright-core install webkit を実行してください");
      fail++;
    } else throw e;
  }
}
console.log(fail ? `${fail} 件 NG` : "すべて OK");
process.exit(fail ? 1 : 0);
