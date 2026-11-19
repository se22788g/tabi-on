// 傾向のひとこと：ルール版（仕様書 A3「ルール版」）。「{上位1}と{上位2}に、心が動くみたい。」
// 段階5で、AI の一文とセットで使う（AIが失敗したとき、この結果を source='rule' で使う）。

/** 上位が1つだけなら「{上位1}に、心が動くみたい。」。ひとつもなければ null（画面側の言葉を出す） */
export function ruleHeadline(topTraits: string[]): string | null {
  const [a, b] = topTraits;
  if (!a) return null;
  return (b ? `${a}と${b}に、心が動くみたい。` : `${a}に、心が動くみたい。`).slice(0, 24);
}
