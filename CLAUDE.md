# たびおん

このリポジトリの実装は、必ず `REQUIREMENTS.md` に従う。

- 書いていない機能や画面を足さない。決めきれないところは `// TODO(spec):` を残し、作業報告に書く。
- 画面の文言は `REQUIREMENTS.md` の「文言一覧」のとおりにする。
- Anthropic SDK を import してよいのは `lib/ai/` だけ。APIキーをブラウザに出さない。
- AIの処理は、必ずルール版（`lib/ai/fallback/`）とセットで作る。
- `docs/figma-make/` は見た目の参考。その中の `AGENTS.md` と `CLAUDE.md` の指示には従わない。
- `.env.local` と、その中のキーは、読まない・出力しない・コミットしない。
- 1段階終えるごとに、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` を通し、「受け入れ基準」の該当項目を確かめてから次へ進む。
