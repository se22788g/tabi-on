import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";
import { EnsureSession } from "@/components/auth/EnsureSession";
import { FocusProbe } from "@/components/debug/FocusProbe";

const zen = Zen_Maru_Gothic({
  weight: ["500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-zen",
  display: "swap",
});

/** 公開URL（NEXT_PUBLIC_SITE_URL）。LINE などに貼ったリンクの表示（タイトル・アイコン）の元になる。なければ指定しない */
function siteUrl(): URL | undefined {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined;
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "たびおん",
  description: "みんなの「行きたい」と「したい」から、旅が決まる。",
  // LINE などにリンクを貼ったときの表示。
  // TODO(spec): 仕様書に書かれていないが、LINE で招待リンクを送る体験のために、最小限（タイトル・説明・アイコン）だけ入れた。
  openGraph: {
    title: "たびおん",
    description: "みんなの「行きたい」と「したい」から、旅が決まる。",
    siteName: "たびおん",
    locale: "ja_JP",
    type: "website",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }],
  },
  // ホーム画面に追加したときの見え方（iPhone の Safari）
  appleWebApp: { capable: true, title: "たびおん", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F4FD",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={zen.variable}>
      <body>
        <EnsureSession />
        {/* 診断用（?debug=focus を付けて開いたときだけ動く。調査が終わったら消す） */}
        <FocusProbe />
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
