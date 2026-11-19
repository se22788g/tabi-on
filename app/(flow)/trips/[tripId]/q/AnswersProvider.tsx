"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AnswerValue = string[] | number | null;
type Ctx = { answers: Record<string, AnswerValue>; set: (id: string, v: AnswerValue) => void };

const AnswersContext = createContext<Ctx | null>(null);

export function AnswersProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const value = useMemo<Ctx>(() => ({ answers, set: (id, v) => setAnswers((a) => ({ ...a, [id]: v })) }), [answers]);
  return <AnswersContext.Provider value={value}>{children}</AnswersContext.Provider>;
}

export function useAnswers(): Ctx {
  const ctx = useContext(AnswersContext);
  if (!ctx) throw new Error("AnswersProvider がありません");
  return ctx;
}
