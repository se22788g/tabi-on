import { describe, expect, it } from "vitest";
import { accountEmail, isEmailTaken, isRateLimited, isValidEmail, safeNext } from "./account";

describe("アカウント登録（メールのみ）", () => {
  it("すでに登録されたメールは、ログイン用のリンクに切り替える", () => {
    expect(isEmailTaken({ status: 422, code: "email_exists" })).toBe(true);
    expect(isEmailTaken({ message: "A user with this email address has already been registered" })).toBe(true);
    expect(isEmailTaken({ status: 500, message: "boom" })).toBe(false);
    expect(isEmailTaken(null)).toBe(false);
  });
  it("送りすぎは、別の文言にする", () => {
    expect(isRateLimited({ status: 429 })).toBe(true);
    expect(isRateLimited({ code: "over_email_send_rate_limit" })).toBe(true);
    expect(isRateLimited({ message: "email rate limit exceeded" })).toBe(true);
    expect(isRateLimited({ status: 422 })).toBe(false);
  });
  it("メールアドレスの形", () => {
    expect(isValidEmail("a@example.com")).toBe(true);
    expect(isValidEmail("  a@example.com ")).toBe(true);
    expect(isValidEmail("a@example")).toBe(false);
    expect(isValidEmail("a b@example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
  it("リンクを開いたあとの戻り先は、このサイトの中だけ", () => {
    expect(safeNext("/me")).toBe("/me");
    expect(safeNext("/trips/abc/invite")).toBe("/trips/abc/invite");
    expect(safeNext("https://evil.example/")).toBe("/me");
    expect(safeNext("//evil.example")).toBe("/me");
    expect(safeNext("/\\evil.example")).toBe("/me");
    expect(safeNext(null)).toBe("/me");
    expect(safeNext("javascript:alert(1)")).toBe("/me");
  });
  it("アカウントがある＝匿名ではなく、メールがある", () => {
    expect(accountEmail({ is_anonymous: true, email: null })).toBeNull();
    expect(accountEmail({ is_anonymous: false, email: "a@example.com" })).toBe("a@example.com");
    expect(accountEmail({ is_anonymous: false, email: null })).toBeNull();
    expect(accountEmail(null)).toBeNull();
  });
});
