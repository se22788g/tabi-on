import { TabBar } from "@/components/layout/TabBar";

// 見る画面（M2〜M7）。必ず下部タブバーを出す。
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
