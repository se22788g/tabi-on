import { describe, expect, it } from "vitest";
import { creditLinks, sizedUrl, withUtm } from "./image-url";

describe("写真の URL", () => {
  const u = "https://images.unsplash.com/photo-1?ixid=abc123&ixlib=rb-4.1.0&q=80&w=1080&fit=crop";
  it("幅（w）だけを変える。ixid などは、消さない（Unsplash の規約）", () => {
    const r = new URL(sizedUrl(u, 160));
    expect(r.searchParams.get("w")).toBe("160");
    expect(r.searchParams.get("ixid")).toBe("abc123");
    expect(r.searchParams.get("ixlib")).toBe("rb-4.1.0");
    expect(r.searchParams.get("fit")).toBe("crop");
  });
  it("w がなければ足す。Unsplash 以外の URL と、おかしな URL は、そのまま", () => {
    expect(new URL(sizedUrl("https://images.unsplash.com/photo-2?ixid=x", 240)).searchParams.get("w")).toBe("240");
    expect(sizedUrl("https://example.com/a.jpg?w=1", 240)).toBe("https://example.com/a.jpg?w=1");
    expect(sizedUrl("not a url", 240)).toBe("not a url");
  });
  it("出典のリンクには utm_source=tabi-on&utm_medium=referral を付ける（Unsplash の規約）", () => {
    expect(withUtm("https://unsplash.com/@anniespratt")).toBe("https://unsplash.com/@anniespratt?utm_source=tabi-on&utm_medium=referral");
    expect(withUtm("https://unsplash.com/@a?x=1")).toBe("https://unsplash.com/@a?x=1&utm_source=tabi-on&utm_medium=referral");
    expect(withUtm("https://unsplash.com/@a?utm_source=tabi-on&utm_medium=referral")).toBe("https://unsplash.com/@a?utm_source=tabi-on&utm_medium=referral");
  });
  it("撮影者がいれば、撮影者と Unsplash の2つのリンク。いなければ null", () => {
    const l = creditLinks("Annie Spratt", "https://unsplash.com/@anniespratt")!;
    expect(l.name).toBe("Annie Spratt");
    expect(l.photographerUrl).toContain("utm_source=tabi-on");
    expect(l.unsplashUrl).toBe("https://unsplash.com/?utm_source=tabi-on&utm_medium=referral");
    expect(creditLinks("", "")).toBeNull();
  });
});
