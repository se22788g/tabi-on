import { describe, expect, it } from "vitest";
import { checkEnv } from "../scripts/verify-env.mjs";

const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.sig`;
const good = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
  SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
  NEXT_PUBLIC_SITE_URL: "https://tabion.vercel.app",
};

describe("環境変数の検査（デプロイの前）", () => {
  it("そろっていれば、何も出ない", () => {
    expect(checkEnv(good, { production: true })).toEqual({ errors: [], warnings: [] });
  });
  it("本番（Vercel）では、足りないものがエラー。自分のパソコンでは警告だけ", () => {
    const { NEXT_PUBLIC_SUPABASE_ANON_KEY: _a, ...rest } = good;
    void _a;
    expect(checkEnv(rest, { production: true }).errors.join()).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const local = checkEnv(rest, { production: false });
    expect(local.errors).toEqual([]);
    expect(local.warnings.join()).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
  it("ブラウザに出る側に、service_role キーを入れる間違いを止める", () => {
    const r = checkEnv({ ...good, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("service_role") }, { production: false });
    expect(r.errors.join()).toContain("service_role キーが入っています");
    expect(checkEnv({ ...good, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abc" }, { production: false }).errors.join()).toContain("secret キー");
  });
  it("service 側に、anon キーや同じ値を入れる間違いを止める", () => {
    expect(checkEnv({ ...good, SUPABASE_SERVICE_ROLE_KEY: `${jwt("anon")}x` }, { production: true }).errors.join()).toContain("anon キー");
    expect(checkEnv({ ...good, SUPABASE_SERVICE_ROLE_KEY: good.NEXT_PUBLIC_SUPABASE_ANON_KEY }, { production: true }).errors.join()).toContain("同じ値");
    expect(checkEnv({ ...good, SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_x" }, { production: true }).errors.join()).toContain("publishable");
  });
  it("秘密の値に NEXT_PUBLIC_ を付けた名前を止める", () => {
    expect(checkEnv({ ...good, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "x" }, { production: false }).errors.join()).toContain("NEXT_PUBLIC_ を外した名前");
    expect(checkEnv({ ...good, NEXT_PUBLIC_ANTHROPIC_API_KEY: "x" }, { production: false }).errors).toHaveLength(1);
  });
  it("本番で、URL が自分のパソコンや http のときは止める。値は、メッセージに出さない", () => {
    expect(checkEnv({ ...good, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }, { production: true }).errors.length).toBeGreaterThan(0);
    const all = JSON.stringify(checkEnv({ ...good, SUPABASE_SERVICE_ROLE_KEY: good.NEXT_PUBLIC_SUPABASE_ANON_KEY }, { production: true }));
    expect(all).not.toContain(good.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  });
  it("NEXT_PUBLIC_SITE_URL は、本番で無ければ警告、最後の / は警告", () => {
    const { NEXT_PUBLIC_SITE_URL: _s, ...rest } = good;
    void _s;
    expect(checkEnv(rest, { production: true }).warnings.join()).toContain("NEXT_PUBLIC_SITE_URL");
    expect(checkEnv({ ...good, NEXT_PUBLIC_SITE_URL: "https://x.vercel.app/" }, { production: true }).warnings.join()).toContain("最後に / を付けない");
  });
});
