// 変更前・変更後のスクリーンショットを、左右に並べた1枚の画像にする（左＝前、右＝後）。
// 使い方: node scripts/compare-shots.mjs <前のフォルダ> <後のフォルダ> <保存先>
import { chromium } from "playwright-core";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [before, after, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage({ viewport: { width: 800, height: 880 } });
const uri = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
for (const f of readdirSync(before).filter((n) => n.endsWith(".png"))) {
  await page.setContent(`<body style="margin:0;background:#888;display:flex;gap:20px;padding:10px;font:14px sans-serif;color:#fff"><div><div>前（変更前）</div><img src="${uri(join(before, f))}" width="390"></div><div><div>後（変更後）</div><img src="${uri(join(after, f))}" width="390"></div></body>`);
  await page.screenshot({ path: join(out, f), fullPage: true });
}
await browser.close();
console.log("saved");
