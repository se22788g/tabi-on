import { notFound } from "next/navigation";
import { Question } from "./Question";
import { MOCK_CONDITIONS, MOCK_MEMBER_COUNT } from "@/lib/mock/data";
import { visibleQuestions, type Companion, type Nights, type TripConditions } from "@/lib/domain/questions";
import { tripSummary } from "@/lib/domain/trip-label";

type SP = { companion?: string; nights?: string; months?: string };

// TODO(spec): 段階1では旅の条件が仮の固定値。出し分けの確認用に、?companion= ?nights= ?months=1,2 で上書きできる。段階3でDBの旅から読む。
function conditionsFrom(sp: SP): TripConditions {
  return {
    companion: (sp.companion as Companion) ?? MOCK_CONDITIONS.companion,
    nights: (sp.nights as Nights) ?? MOCK_CONDITIONS.nights,
    months: sp.months !== undefined ? sp.months.split(",").map(Number).filter((n) => n >= 1 && n <= 12) : MOCK_CONDITIONS.months,
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string; step: string }>;
  searchParams: Promise<SP>;
}) {
  const { tripId, step } = await params;
  const cond = conditionsFrom(await searchParams);
  const questions = visibleQuestions(cond);
  const n = Number(step);
  if (!Number.isInteger(n) || n < 1 || n > questions.length) notFound();
  const qs = new URLSearchParams();
  const sp = await searchParams;
  for (const k of ["companion", "nights", "months"] as const) if (sp[k] !== undefined) qs.set(k, sp[k]!);
  return (
    <Question
      tripId={tripId}
      n={n}
      total={questions.length}
      question={questions[n - 1]}
      summary={tripSummary({ ...cond, memberCount: MOCK_MEMBER_COUNT })}
      query={qs.toString() ? `?${qs.toString()}` : ""}
    />
  );
}
