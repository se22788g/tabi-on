"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Map, User } from "lucide-react";

type TabId = "trips" | "me";
const TABS = [
  { id: "trips", href: "/trips", label: "旅", Icon: Map },
  { id: "me", href: "/me", label: "マイページ", Icon: User },
] as const;

const LAST_TAB_KEY = "tabion:last-tab";

/**
 * 今いるタブ。
 * TODO(spec): M3 は「旅」、M6・M7 は「マイページ」。M4 は来た側のタブ（直前に見ていたタブをこの端末の
 * sessionStorage に覚えておく。覚えがなければ「旅」）。ずれる場合は M4 のリンクに来た側を持たせる形に変える。
 */
function tabOf(pathname: string): TabId | "spot" {
  if (pathname.startsWith("/me")) return "me";
  if (pathname.startsWith("/spots")) return "spot";
  return "trips";
}

/** 見る画面（M2〜M7）の下に、同じ順番で出す。タブは2つだけ */
export function TabBar() {
  const pathname = usePathname();
  const [fromTab, setFromTab] = useState<TabId>("trips");
  const t = tabOf(pathname);

  useEffect(() => {
    try {
      if (t === "spot") {
        const saved = sessionStorage.getItem(LAST_TAB_KEY);
        if (saved === "me" || saved === "trips") setFromTab(saved);
      } else {
        sessionStorage.setItem(LAST_TAB_KEY, t);
      }
    } catch {
      // 覚えられなくても動く
    }
  }, [t]);

  const current: TabId = t === "spot" ? fromTab : t;
  return (
    <nav className="tab-bar" aria-label="メイン">
      {TABS.map(({ id, href, label, Icon }) => (
        <Link key={id} href={href} aria-current={current === id ? "page" : undefined}>
          <Icon size={22} strokeWidth={2} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
