import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 仕様書：傾向のチップの文字は、各色を濃くした色で、コントラスト4.5:1以上。ほかの文字色も、背景との組み合わせを確かめる。
const css = readFileSync("app/globals.css", "utf8");
const vars = Object.fromEntries([...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

describe("文字のコントラスト", () => {
  for (const tone of ["strong", "often", "normal", "light", "rare"]) {
    it(`傾向のチップ（${tone}）の文字は、背景に対して 4.5:1 以上`, () => {
      expect(vars[`trend-${tone}`], `--trend-${tone}`).toBeDefined();
      expect(ratio(vars[`trend-${tone}-text`], vars[`trend-${tone}`])).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("本文・補足の文字は、ヘッダーの背景に対して 4.5:1 以上", () => {
    expect(ratio(vars["text"], vars["header"])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(vars["text-sub"], vars["header"])).toBeGreaterThanOrEqual(4.5);
  });
  it("強調の文字（--accent）は、ヘッダーの背景に対して 4.5:1 以上（タブバーの選択中の文字）", () => {
    expect(ratio(vars["accent"], vars["header"])).toBeGreaterThanOrEqual(4.5);
  });
});
