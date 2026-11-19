"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** 下から出るシート。上に持ち手 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // 開く前にフォーカスがあったもの（「…」のボタンなど）を覚えておき、閉じたら戻す
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      // フォーカスをシートの中に閉じ込める（最後でTabを押すと最初へ、最初でShift+Tabを押すと最後へ）
      const items = [...(sheetRef.current?.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, summary, [tabindex]") ?? [])].filter(
        (el) => !(el as HTMLButtonElement).disabled && el.getAttribute("tabindex") !== "-1" && el.getClientRects().length > 0,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && !!sheetRef.current?.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  // body の直下に出す：カードのように「ぼかし」を持つ要素の中に置かれても、画面の下に固定されるように
  return createPortal(
    <>
      <button type="button" className="sheet-backdrop" aria-label="閉じる" onClick={onClose} tabIndex={-1} />
      <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <button type="button" ref={closeRef} className="icon-btn" aria-label="閉じる" onClick={onClose}>
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}
