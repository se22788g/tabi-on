import { QuestionsProvider } from "./QuestionsProvider";

// 質問の画面をまたいで、旅の条件と回答を持つ。回答はその都度DBに保存する。
export default async function QuestionsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <QuestionsProvider tripId={tripId}>{children}</QuestionsProvider>;
}
