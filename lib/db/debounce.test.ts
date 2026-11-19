import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounced } from "./debounce";

describe("debounced", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("続けて呼んでも、最後から ms たったときに1回だけ実行する", () => {
    const fn = vi.fn();
    const d = debounced(fn, 300);
    d.call();
    vi.advanceTimersByTime(200);
    d.call();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("cancel すると実行しない", () => {
    const fn = vi.fn();
    const d = debounced(fn, 300);
    d.call();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});
