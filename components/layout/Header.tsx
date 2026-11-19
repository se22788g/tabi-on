"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import type { ReactNode } from "react";

export type HeaderLeft =
  | { type: "back"; href?: string; onClick?: () => void }
  | { type: "close"; href: string }
  | null;

/**
 * ヘッダー。左は「戻る」か「閉じる」専用、右は「その画面の操作」専用。
 * 別の画面に移るためのアイコンは置かない（ハンバーガーメニューはなし）。
 */
export function Header({
  left = null,
  title,
  center,
  right,
}: {
  left?: HeaderLeft;
  title?: string;
  /** title の代わりに中央へ置くもの（ロゴ、進み具合のバー） */
  center?: ReactNode;
  right?: ReactNode;
}) {
  const router = useRouter();
  let leftNode: ReactNode = null;
  if (left?.type === "close") {
    leftNode = (
      <Link href={left.href} className="icon-btn" aria-label="閉じる">
        <X size={22} strokeWidth={2} />
      </Link>
    );
  } else if (left?.type === "back") {
    const icon = <ChevronLeft size={22} strokeWidth={2} />;
    leftNode = left.href ? (
      <Link href={left.href} className="icon-btn" aria-label="戻る">
        {icon}
      </Link>
    ) : (
      <button type="button" className="icon-btn" aria-label="戻る" onClick={left.onClick ?? (() => router.back())}>
        {icon}
      </button>
    );
  }
  return (
    <header className="app-header">
      <div className="header-slot">{leftNode}</div>
      <div className="header-center">{center ?? <p className="header-title">{title}</p>}</div>
      <div className="header-slot right">{right}</div>
    </header>
  );
}

export function Logo() {
  return (
    <span className="wordmark" role="img" aria-label="TABI ON たびおん">
      <span className="wordmark-main">
        <b>TABI</b>
        <strong>ON</strong>
      </span>
      <small>たびおん</small>
    </span>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}
