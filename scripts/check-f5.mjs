// F5：見本が丸のラベル付き・aria-hidden、「はじめる」が固定でなく見本の24px下、44px以上
import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto("http://localhost:3000/trips/demo/intro", { waitUntil: "networkidle" });
await page.waitForSelector("h1");
const r = await page.evaluate(() => {
  const s = document.querySelector(".rate-sample"), b = [...document.querySelectorAll("a,button")].find((x) => x.textContent.trim() === "はじめる");
  const sb = s.getBoundingClientRect(), bb = b.getBoundingClientRect();
  return { hidden: s.getAttribute("aria-hidden"), dots: s.querySelectorAll("i").length, gap: Math.round(bb.top - sb.bottom), h: Math.round(bb.height), pos: getComputedStyle(b.closest(".stack")).position, header: getComputedStyle(document.querySelector(".app-header")).position, text: s.innerText.replace(/\s+/g, " ") };
});
console.log(JSON.stringify(r));
await browser.close();
