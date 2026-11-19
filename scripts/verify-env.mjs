// ビルドの前に、環境変数がそろっているかを確かめる（値は表示しない）。
// Vercel のビルド（VERCEL=1）のときだけ、足りなければビルドを止める。自分のパソコンでは、警告だけ出して通す。
// 使い方: node scripts/verify-env.mjs   （pnpm build の先頭で自動で動く）
import { pathToFileURL } from "node:url";

const isJwt = (v) => /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v);
const jwtRole = (v) => {
  try {
    return JSON.parse(Buffer.from(v.split(".")[1], "base64url").toString()).role ?? null;
  } catch {
    return null;
  }
};

/**
 * 環境変数の検査。値そのものは、戻り値にも入れない。
 * @param {Record<string, string | undefined>} env
 * @param {{ production: boolean }} opts production=true（Vercel など）なら、足りないものは errors、そうでなければ warnings
 * @returns {{ errors: string[]; warnings: string[] }}
 */
export function checkEnv(env, { production }) {
  const errors = [];
  const warnings = [];
  const problem = (msg) => (production ? errors : warnings).push(msg);

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) problem("NEXT_PUBLIC_SUPABASE_URL がありません");
  else if (!/^https:\/\/.+/.test(url)) problem("NEXT_PUBLIC_SUPABASE_URL が https:// で始まっていません（Supabase の Project URL を入れてください）");
  else if (/localhost|127\.0\.0\.1/.test(url) && production) errors.push("NEXT_PUBLIC_SUPABASE_URL が、自分のパソコンのアドレスになっています");

  if (!anon) problem("NEXT_PUBLIC_SUPABASE_ANON_KEY がありません");
  else if (isJwt(anon) && jwtRole(anon) === "service_role") errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY に、service_role キーが入っています。ブラウザに出てしまうので、anon（または publishable）キーに直してください");
  else if (/^sb_secret_/.test(anon)) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY に、secret キーが入っています。ブラウザに出てしまうので、publishable キーに直してください");

  if (!service) problem("SUPABASE_SERVICE_ROLE_KEY がありません（おすすめ・工程案を作る処理で使います）");
  else if (anon && service === anon) errors.push("SUPABASE_SERVICE_ROLE_KEY が、NEXT_PUBLIC_SUPABASE_ANON_KEY と同じ値です（service_role キーを入れてください）");
  else if (isJwt(service) && jwtRole(service) === "anon") errors.push("SUPABASE_SERVICE_ROLE_KEY に、anon キーが入っています（service_role キーを入れてください）");
  else if (/^sb_publishable_/.test(service)) errors.push("SUPABASE_SERVICE_ROLE_KEY に、publishable キーが入っています（secret キーを入れてください）");

  // 秘密の値を、NEXT_PUBLIC_ を付けた名前で入れてしまう間違い（ブラウザに出る）
  for (const name of Object.keys(env)) {
    if (/^NEXT_PUBLIC_/.test(name) && /(SERVICE|SECRET|ANTHROPIC|UNSPLASH)/i.test(name)) {
      errors.push(`${name}：秘密の値に NEXT_PUBLIC_ を付けると、ブラウザに出ます。NEXT_PUBLIC_ を外した名前にしてください`);
    }
  }

  const site = env.NEXT_PUBLIC_SITE_URL;
  if (production && !site) warnings.push("NEXT_PUBLIC_SITE_URL がありません（共有したときのリンクの表示に使います。公開URLが決まったら入れて、もう一度デプロイしてください）");
  else if (site && !/^https?:\/\/[^/]+$/.test(site)) warnings.push("NEXT_PUBLIC_SITE_URL は、https://example.vercel.app のように、最後に / を付けない形にしてください");

  return { errors, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const production = Boolean(process.env.VERCEL);
  const { errors, warnings } = checkEnv(process.env, { production });
  for (const w of warnings) console.warn(`注意  ${w}`);
  for (const e of errors) console.error(`NG    ${e}`);
  if (errors.length) {
    console.error("環境変数を直してから、もう一度デプロイしてください（Vercel の Settings → Environment Variables）。");
    process.exit(1);
  }
  console.log(production ? "環境変数：そろっています" : "環境変数：確認しました（Vercel ではない環境なので、足りなくても止めません）");
}
