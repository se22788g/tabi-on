import { AnswersProvider } from "./AnswersProvider";

// 質問の画面をまたいで回答を持つ。戻っても回答は消えない。
// TODO(spec): 段階3で、回答はその都度DBに保存する形に置き換える。
export default function QuestionsLayout({ children }: { children: React.ReactNode }) {
  return <AnswersProvider>{children}</AnswersProvider>;
}
