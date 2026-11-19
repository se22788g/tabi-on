import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: [".next/**", "node_modules/**", "docs/**", "scripts/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Unsplash の写真を URL のまま表示する（仕様書：写真の用意の仕方）
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
