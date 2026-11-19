import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";
import { EnsureSession } from "@/components/auth/EnsureSession";

const zen = Zen_Maru_Gothic({
  weight: ["500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-zen",
  display: "swap",
});

export const metadata: Metadata = {
  title: "たびおん",
  description: "みんなの「行きたい」と「したい」から、旅が決まる。",
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
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
