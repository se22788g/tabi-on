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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
