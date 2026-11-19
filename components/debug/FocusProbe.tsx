"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/db/browser";

/**
 * 診断用（調査が終わったら消す。TODO(spec): 仕様書にない。iPhone の実機で、入力欄のフォーカスが外れる原因を調べるためだけのもの）。
 * アドレスの末尾に ?debug=focus を付けて開いたときだけ動く。普通に開いたときは、何もしない。
 * 画面の上に、フォーカスの移動・入力欄が消えた・画面の大きさやスクロールの変化・ログインの通知を、新しい順に出す。
 * 入力した文字の中身は、記録しない（要素の種類と名前だけ）。「コピー」で、全部をコピーして、貼り付けて送れる。
 */
type Entry = { t: number; msg: string };

const describe = (el: unknown): string => {
  if (!(el instanceof Element)) return String(el);
  const label = el.getAttribute("aria-label") || el.getAttribute("placeholder") || (el.textContent ?? "").trim().slice(0, 12);
  return `${el.tagName.toLowerCase()}${el.getAttribute("type") ? `[${el.getAttribute("type")}]` : ""}「${label}」${el.isConnected ? "" : "（DOMから消えている）"}`;
};

export function FocusProbe() {
  const [enabled, setEnabled] = useState(false);
  const [log, setLog] = useState<Entry[]>([]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("debug") !== "focus") return;
    setEnabled(true);
    const t0 = Date.now();
    const entries: Entry[] = [];
    const push = (msg: string) => {
      entries.unshift({ t: Date.now() - t0, msg });
      if (entries.length > 60) entries.pop();
      setLog([...entries]);
    };
    push(`開始 ${navigator.userAgent.includes("iPhone") ? "iPhone" : "その他"} vv=${Math.round(window.visualViewport?.height ?? 0)}`);

    // フォーカスを動かす・外す呼び出しが、どこから来たか
    const proto = HTMLElement.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    const orig: Record<string, (...a: unknown[]) => unknown> = {};
    for (const m of ["focus", "blur"]) {
      orig[m] = proto[m];
      proto[m] = function (this: HTMLElement, ...a: unknown[]) {
        const stack = (new Error().stack ?? "").split("\n").slice(2, 4).map((s) => s.trim().replace(/https?:\/\/[^/]+/, "").slice(0, 80)).join(" ← ");
        push(`${m}() ${describe(this)} ／ ${stack}`);
        return orig[m].apply(this, a);
      };
    }
    const onOut = (e: FocusEvent) => push(`focusout ${describe(e.target)} → ${e.relatedTarget ? describe(e.relatedTarget) : "なし"}`);
    const onIn = (e: FocusEvent) => push(`focusin ${describe(e.target)}`);
    document.addEventListener("focusout", onOut, true);
    document.addEventListener("focusin", onIn, true);
    const mo = new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.removedNodes) if (n.nodeType === 1 && ((n as Element).matches("input") || (n as Element).querySelector("input"))) push("入力欄を含む要素が、DOMから外れた");
    });
    mo.observe(document.body, { childList: true, subtree: true });
    const onResize = () => push(`window resize ${window.innerWidth}×${window.innerHeight}`);
    const onVv = () => push(`visualViewport ${Math.round(window.visualViewport?.height ?? 0)}高 上端${Math.round(window.visualViewport?.offsetTop ?? 0)} scrollY=${Math.round(window.scrollY)}`);
    const onScroll = () => push(`scroll y=${Math.round(window.scrollY)}`);
    const onVis = () => push(`visibility ${document.visibilityState}`);
    const onShow = (e: PageTransitionEvent) => push(`pageshow persisted=${e.persisted}`);
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onVv);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onShow);
    const sub = getBrowserSupabase()?.auth.onAuthStateChange((event) => push(`auth ${event}`));
    return () => {
      proto.focus = orig.focus;
      proto.blur = orig.blur;
      document.removeEventListener("focusout", onOut, true);
      document.removeEventListener("focusin", onIn, true);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onVv);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onShow);
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  if (!enabled) return null;
  return (
    <div
      role="log"
      aria-label="診断ログ"
      style={{ position: "fixed", zIndex: 9999, top: 0, left: 0, right: 0, maxHeight: "32vh", overflow: "hidden", background: "rgba(0,0,0,0.78)", color: "#8f8", font: "10px/1.35 monospace", padding: "4px 6px", pointerEvents: "none", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
    >
      <button
        type="button"
        tabIndex={-1}
        // フォーカスを奪わない（押したときに、入力欄のフォーカスが外れないように）
        onMouseDown={(e) => e.preventDefault()}
        onTouchStart={(e) => e.preventDefault()}
        onClick={() => void navigator.clipboard?.writeText(log.map((l) => `${l.t}ms ${l.msg}`).join("\n"))}
        style={{ position: "absolute", right: 4, top: 4, pointerEvents: "auto", background: "#fff", color: "#000", borderRadius: 4, padding: "2px 8px" }}
      >
        コピー
      </button>
      {log.slice(0, 18).map((l, i) => (
        <div key={`${l.t}-${i}`}>{`${l.t}ms ${l.msg}`}</div>
      ))}
    </div>
  );
}
