// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomSheet } from "./BottomSheet";

afterEach(cleanup);

/**
 * 再発を防ぐテスト：シートの中の入力欄に1文字打つたびに、親が描き直されて、onClose が新しい関数になる（onClose={() => …}）。
 * 以前は、そのたびにシートの効果が「終わって、また始まり」、閉じるボタンにフォーカスが移って、スマホのキーボードが消えた。
 */
function Parent({ onChange }: { onChange?: (v: string) => void }) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState("");
  return (
    <>
      <button type="button">開く</button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="メールで続ける">
        <input
          aria-label="メールアドレス"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onChange?.(e.target.value);
          }}
        />
      </BottomSheet>
    </>
  );
}

describe("BottomSheet", () => {
  it("中の入力欄に1文字ずつ打っても、フォーカスが入力欄から外れない", async () => {
    const user = userEvent.setup();
    render(<Parent />);
    const input = screen.getByLabelText("メールアドレス");
    await user.click(input);
    const text = "ayako@example.com";
    for (let i = 1; i <= text.length; i++) {
      await user.keyboard(text[i - 1]);
      expect(document.activeElement, `${i}文字目のあと`).toBe(input);
      expect((input as HTMLInputElement).value).toBe(text.slice(0, i));
    }
  });

  it("入力欄の DOM が、打つたびに作り直されない（同じ要素のまま）", async () => {
    const user = userEvent.setup();
    render(<Parent />);
    const first = screen.getByLabelText("メールアドレス");
    await user.type(first, "abc");
    expect(screen.getByLabelText("メールアドレス")).toBe(first);
  });

  it("開いたときは、閉じるボタンにフォーカスが移る。Escape で閉じ、最新の onClose が呼ばれる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<BottomSheet open onClose={() => undefined} title="x"><input aria-label="a" /></BottomSheet>);
    expect(document.activeElement).toBe(screen.getAllByLabelText("閉じる").find((el) => el.tagName === "BUTTON" && el.classList.contains("icon-btn")));
    rerender(<BottomSheet open onClose={onClose} title="x"><input aria-label="a" /></BottomSheet>);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("閉じたら、開く前にフォーカスのあったボタンに戻る", async () => {
    const user = userEvent.setup();
    function Toggle() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>開く</button>
          <BottomSheet open={open} onClose={() => setOpen(false)} title="x"><input aria-label="a" /></BottomSheet>
        </>
      );
    }
    render(<Toggle />);
    const opener = screen.getByRole("button", { name: "開く" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
