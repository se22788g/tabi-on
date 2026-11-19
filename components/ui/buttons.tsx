import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type Common = { children: ReactNode; href?: string; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" };

/** メインボタン。画面の下に固定する BottomBar の中に、画面に1つだけ置く */
export function PrimaryButton({ children, href, onClick, disabled, type = "button" }: Common) {
  if (href && !disabled) {
    return (
      <Link href={href} className="primary-btn">
        {children}
        <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
      </Link>
    );
  }
  return (
    <button type={type} className="primary-btn" onClick={onClick} disabled={disabled}>
      {children}
      <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

export function SecondaryButton({ children, href, onClick, disabled, type = "button" }: Common) {
  if (href && !disabled) {
    return (
      <Link href={href} className="secondary-btn">
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className="secondary-btn" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function TextLink({ children, href, onClick }: Omit<Common, "disabled" | "type">) {
  if (href) {
    return (
      <Link href={href} className="text-link">
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className="text-link" onClick={onClick}>
      {children}
    </button>
  );
}

/** 画面の下に固定する部分（背景は不透明） */
export function BottomBar({ children, two }: { children: ReactNode; two?: boolean }) {
  return <div className={`bottom-bar ${two ? "two" : ""}`}>{children}</div>;
}
