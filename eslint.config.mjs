import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: [".next/**", "node_modules/**", "docs/**", "scripts/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Unsplash の写真を URL のまま表示する（仕様書：写真の用意の仕方）
      "@next/next/no-img-element": "off",
      // 部品を、別の部品の中で定義すると、描き直されるたびに作り直され、入力欄のフォーカスが外れる（1文字ごとにキーボードが消える）。禁止する
      "react/no-unstable-nested-components": "error",
    },
  },
];

export default config;
