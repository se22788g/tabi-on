"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

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
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <button type="button" className="sheet-backdrop" aria-label="閉じる" onClick={onClose} tabIndex={-1} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <button type="button" ref={closeRef} className="icon-btn" aria-label="閉じる" onClick={onClose}>
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
