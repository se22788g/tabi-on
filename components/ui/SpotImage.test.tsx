// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PhotoCredit } from "./PhotoCredit";
import { SpotImage } from "./SpotImage";

afterEach(cleanup);
const URL = "https://images.unsplash.com/photo-abc?ixid=XYZ&ixlib=rb-4.1.0&w=1080";

describe("SpotImage（写真を出す、たった1つの部品）", () => {
  it("写真：alt は場所名、遅延読み込み、表示の2倍の幅で読み込む（ixid は残す）。縦横比を先に決める", () => {
    const { container } = render(<SpotImage src={URL} name="雪見露天の宿 しろがね荘" area="銀山温泉" category="onsen" aspect="16/10" displayWidth={200} />);
    const img = screen.getByAltText("雪見露天の宿 しろがね荘") as HTMLImageElement;
    expect(img.getAttribute("loading")).toBe("lazy");
    const u = new window.URL(img.src);
    expect(u.searchParams.get("w")).toBe("400");
    expect(u.searchParams.get("ixid")).toBe("XYZ");
    expect((container.firstChild as HTMLElement).style.aspectRatio).toBe("16 / 10");
    expect((container.firstChild as HTMLElement).className).toContain("cat-onsen");
  });
  it("先頭の写真は eager", () => {
    render(<SpotImage src={URL} name="a" eager />);
    expect(screen.getByAltText("a").getAttribute("loading")).toBe("eager");
  });
  it("読み込めないとき：代わりの画像（エリア名）に替わる。alt（場所名）は、そのまま", () => {
    const { container } = render(<SpotImage src={URL} name="樹氷の森スノーシュー体験" area="蔵王" category="activity" />);
    fireEvent.error(screen.getByAltText("樹氷の森スノーシュー体験"));
    expect(screen.queryByRole("img", { name: "樹氷の森スノーシュー体験" })?.textContent).toBe("蔵王");
    expect(container.querySelector("img")).toBeNull();
    expect((container.firstChild as HTMLElement).getAttribute("data-state")).toBe("failed");
  });
  it("写真がない（null）ときも、代わりの画像", () => {
    render(<SpotImage src={null} name="場所" area="箱根" category="food" />);
    expect(screen.getByRole("img", { name: "場所" }).textContent).toBe("箱根");
  });
  it("読み込めたら、loaded", () => {
    const { container } = render(<SpotImage src={URL} name="a" />);
    fireEvent.load(screen.getByAltText("a"));
    expect((container.firstChild as HTMLElement).getAttribute("data-state")).toBe("loaded");
  });
  it("サイトにない場所：写真があるように見せない。ピンのアイコンだけの画像で、alt なし・読み上げの対象外", () => {
    const { container } = render(<SpotImage variant="free" name="熊野古道" aspect="fill" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("free");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.queryByAltText("熊野古道")).toBeNull();
  });
});

describe("PhotoCredit（Unsplash の出典）", () => {
  it("撮影者と Unsplash の2つのリンクに、utm_source=tabi-on&utm_medium=referral を付ける", () => {
    render(<PhotoCredit credit="Annie Spratt" creditUrl="https://unsplash.com/@anniespratt" />);
    const a = screen.getByRole("link", { name: "Annie Spratt" }) as HTMLAnchorElement;
    expect(a.href).toBe("https://unsplash.com/@anniespratt?utm_source=tabi-on&utm_medium=referral");
    expect(a.rel).toContain("noopener");
    expect((screen.getByRole("link", { name: "Unsplash" }) as HTMLAnchorElement).href).toBe("https://unsplash.com/?utm_source=tabi-on&utm_medium=referral");
  });
  it("撮影者が分からない写真には、出さない", () => {
    const { container } = render(<PhotoCredit credit="" />);
    expect(container.textContent).toBe("");
  });
});
