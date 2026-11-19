// docs/brand/app-icon.png（元のアイコン画像）から、アプリのアイコンを作る。ブラウザの canvas で描くので、追加のツールは要らない。
// 使い方: node scripts/make-icons.mjs
//
// 元画像は、角の丸い四角（クリーム色）が、影つきで、薄い縁取りの中に置かれている。
// iPhone のホーム画面のアイコンは、画面いっぱいの四角で渡すと OS が角を丸めるため、そのまま使うと「四角の中に四角」になってしまう。
// そこで、ロゴを中心に切り出し、丸い四角の外側（影の輪）は、中と同じクリーム色で塗りつぶして、画面いっぱいの四角にする。
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SRC = "docs/brand/app-icon.png";
// 元画像（1254×1254）での、ロゴの中心と、切り出す一辺。ロゴは x 188〜1090、y 290〜990 にあり、一辺 1100 だと、まわりに 8%以上の余白が残る
const CENTER = [639, 640];
const SIDE = 1100;
// 丸い四角の「中」（影の輪より内側）。これより外は、クリーム色で塗る
const INNER = { x1: 105, y1: 105, x2: 1150, y2: 1120, radius: 290 };
const CREAM = "rgb(253, 249, 241)";

const OUT = [
  ["app/icon.png", 512], // ブラウザのタブ
  ["app/apple-icon.png", 180], // iPhone のホーム画面
  ["public/icons/icon-192.png", 192], // PWA の manifest
  ["public/icons/icon-512.png", 512], // PWA の manifest、LINE に貼ったリンクの表示
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage();
const b64 = readFileSync(SRC).toString("base64");
const results = await page.evaluate(
  async ({ b64, CENTER, SIDE, INNER, CREAM, sizes }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    // 1. 一辺 SIDE の正方形に、ロゴを中心にして描く（丸い四角の外は、クリーム色）
    const master = document.createElement("canvas");
    master.width = master.height = SIDE;
    const mx = master.getContext("2d");
    mx.fillStyle = CREAM;
    mx.fillRect(0, 0, SIDE, SIDE);
    const ox = Math.round(CENTER[0] - SIDE / 2);
    const oy = Math.round(CENTER[1] - SIDE / 2);
    mx.save();
    mx.beginPath();
    // 角も丸く切り取る（元画像の丸い四角の、角の外側にある影の色を、取り込まないため）
    mx.roundRect(INNER.x1 - ox, INNER.y1 - oy, INNER.x2 - INNER.x1, INNER.y2 - INNER.y1, INNER.radius);
    mx.clip();
    mx.drawImage(img, -ox, -oy);
    mx.restore();
    // 2. 縮める：一気に縮めるとぼやけるので、半分ずつ縮めて、最後に目的の大きさにする
    const shrink = (from, size) => {
      let cur = from;
      while (cur.width / 2 > size) {
        const c = document.createElement("canvas");
        c.width = c.height = Math.round(cur.width / 2);
        const x = c.getContext("2d");
        x.imageSmoothingQuality = "high";
        x.drawImage(cur, 0, 0, c.width, c.height);
        cur = c;
      }
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const x = c.getContext("2d");
      x.imageSmoothingQuality = "high";
      x.drawImage(cur, 0, 0, size, size);
      return c;
    };
    return sizes.map((s) => shrink(master, s).toDataURL("image/png").split(",")[1]);
  },
  { b64, CENTER, SIDE, INNER, CREAM, sizes: OUT.map(([, s]) => s) },
);
OUT.forEach(([path, size], i) => {
  writeFileSync(path, Buffer.from(results[i], "base64"));
  console.log(`${path}  ${size}x${size}`);
});
await browser.close();
