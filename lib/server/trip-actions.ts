"use server";

// 段階3：サービスロールが必要な処理（おすすめ・工程案の作成）。ブラウザからは Server Action として呼ぶ。
// 呼んだ人が、その旅のメンバーであることを、ログイン中のユーザーとして（RLS で）確かめてから、サービスロールで読み書きする。
import { createCandidates } from "@/lib/ai/candidates";
import { createPlan } from "@/lib/ai/plan";
import { aggregateAnswers, answersOf, type AnswerRow } from "@/lib/domain/answers";
import { candidateCountToAdd, filterSpots, MAX_CANDIDATES_PER_TRIP } from "@/lib/domain/candidate-rules";
import { daysFor } from "@/lib/domain/plan-rules";
import type { Nights } from "@/lib/domain/questions";
import type { CandidateStat } from "@/lib/domain/ratings";
import { spotFromRow, type Spot } from "@/lib/domain/spot";
import { nearestOrigin } from "@/lib/domain/travel";
import { getServerSupabase } from "@/lib/db/server";
import { getServiceSupabase } from "@/lib/db/service";

type Ctx = { service: ReturnType<typeof getServiceSupabase>; uid: string; memberId: string; answeredAt: string | null; ratedAt: string | null };

/** ログイン中の人が、その旅のメンバーかを確かめる（ユーザーとして RLS を通す） */
async function authorize(tripId: string): Promise<Ctx | null> {
  const user = await getServerSupabase();
  if (!user) return null;
  const { data: auth } = await user.auth.getUser();
  if (!auth.user) return null;
  const { data: me } = await user.from("members").select("id, answered_at, rated_at").eq("trip_id", tripId).eq("user_id", auth.user.id).maybeSingle();
  if (!me) return null;
  return { service: getServiceSupabase(), uid: auth.user.id, memberId: me.id, answeredAt: me.answered_at, ratedAt: me.rated_at };
}

async function loadSpots(service: Ctx["service"]): Promise<Spot[]> {
  const { data, error } = await service.from("spots").select("*");
  if (error) throw error;
  return (data ?? []).map(spotFromRow);
}

export type CandidatesActionResult = { ok: boolean; source: "ai" | "rule" | null; created: number };

/**
 * A1 おすすめを作る：メンバーが質問を終えて F5 を開いたとき。
 * 同じ人が何度呼んでも、おすすめは1回しか足さない。最初に答えた人は5件、それ以降は3件、旅全体で12件まで。
 */
export async function generateCandidatesAction(tripId: string): Promise<CandidatesActionResult> {
  try {
    const ctx = await authorize(tripId);
    if (!ctx) return { ok: false, source: null, created: 0 };
    const { service, memberId } = ctx;

    const { data: existing } = await service.from("candidates").select("id, spot_ids, for_member_id, source").eq("trip_id", tripId);
    const list = existing ?? [];
    if (list.some((c) => c.for_member_id === memberId)) return { ok: true, source: null, created: 0 };
    const count = candidateCountToAdd(list.length);
    if (count === 0 || list.length >= MAX_CANDIDATES_PER_TRIP) return { ok: true, source: null, created: 0 };

    const { data: trip } = await service.from("trips").select("companion, months, nights, origin, regions, seed_spot_id").eq("id", tripId).single();
    if (!trip) return { ok: false, source: null, created: 0 };
    const { data: members } = await service.from("members").select("id, answered_at").eq("trip_id", tripId);
    const answered = (members ?? []).filter((m) => m.answered_at !== null || m.id === memberId).map((m) => m.id);
    const { data: rows } = await service.from("answers").select("member_id, question_id, value").in("member_id", answered);
    const answers: AnswerRow[] = (rows ?? []).map((r) => ({ memberId: r.member_id, questionId: r.question_id, value: r.value }));
    const aggregate = aggregateAnswers(answers);
    const mineAll = answersOf(answers, memberId);
    const mine: Record<string, string[]> = {};
    for (const q of ["wants", "season", "food"]) if (Array.isArray(mineAll[q])) mine[q] = mineAll[q] as string[];

    const spots = await loadSpots(service);
    const originCity = trip.origin ? nearestOrigin(trip.origin) : null;
    const pool = filterSpots(spots, { regions: trip.regions ?? [], months: trip.months ?? [], nights: trip.nights as Nights, originCity });
    const byId = new Map(spots.map((s) => [s.id, s]));
    // 必ず1件に入れる：seed の場所、いま答えた人が追加した場所、ほかの人が追加した場所
    const placeIds = [...(Array.isArray(mineAll.places) ? (mineAll.places as string[]) : []), ...aggregate.places];
    const forced = [...new Set([trip.seed_spot_id, ...placeIds].filter((id): id is string => Boolean(id)))]
      .map((id) => byId.get(id))
      .filter((s): s is Spot => Boolean(s))
      // seed は、新しい旅の最初のおすすめに入れる。すでにあるおすすめに入っている場所は、入れ直さない
      .filter((s) => !list.some((c) => (c.spot_ids as string[]).includes(s.id)));

    const result = await createCandidates({ spots: pool, aggregate, mine, forced, existing: list.map((c) => c.spot_ids as string[]), count });
    if (result.candidates.length === 0) return { ok: true, source: result.source, created: 0 };
    const { error } = await service.from("candidates").insert(
      result.candidates.map((c) => ({
        trip_id: tripId,
        title: c.title,
        area_label: c.area_label,
        spot_ids: c.spot_ids,
        tags: c.tags,
        reason: c.reason,
        source: result.source,
        for_member_id: memberId,
      })),
    );
    if (error) throw error;
    return { ok: true, source: result.source, created: result.candidates.length };
  } catch (e) {
    console.error("generateCandidatesAction", e);
    return { ok: false, source: null, created: 0 };
  }
}

/**
 * A2 工程案を作る：メンバーが行きたい度合いを終えた（またはとばした）とき。工程案がまだないときも。
 * 呼ぶ前に、その人の rated_at を入れておく（ブラウザから、自分の行を更新する）。
 * 絶対行く・手で直した予定は残し、外した場所は戻さない（DB の save_plan が消さずに残す）。
 */
export async function generatePlanAction(tripId: string): Promise<{ ok: boolean }> {
  try {
    const ctx = await authorize(tripId);
    if (!ctx || !ctx.ratedAt) return { ok: false };
    const { service, memberId } = ctx;

    const { data: trip } = await service.from("trips").select("nights").eq("id", tripId).single();
    if (!trip) return { ok: false };
    const { data: cands } = await service.from("candidates").select("id, spot_ids, created_at").eq("trip_id", tripId).order("created_at").order("id");
    const candidates = (cands ?? []).map((c) => ({ id: c.id as string, spotIds: c.spot_ids as string[] }));
    const { data: statRows, error: statErr } = await service.rpc("candidate_stats", { p_trip_id: tripId });
    if (statErr) throw statErr;
    const stats: CandidateStat[] = ((statRows ?? []) as { candidate_id: string; level_sum: number; level_min: number; level_count: number }[]).map((r) => ({
      candidateId: r.candidate_id,
      sum: r.level_sum,
      min: r.level_min,
      count: r.level_count,
    }));

    const { data: members } = await service.from("members").select("id, rated_at").eq("trip_id", tripId);
    const ratedCount = (members ?? []).filter((m) => m.rated_at !== null).length;
    const { data: ansRows } = await service.from("answers").select("member_id, question_id, value").in("question_id", ["pace", "style"]).in("member_id", (members ?? []).map((m) => m.id));
    const agg = aggregateAnswers((ansRows ?? []).map((r) => ({ memberId: r.member_id, questionId: r.question_id, value: r.value })));

    const { data: keptRows } = await service.from("plan_items").select("spot_id, day, pinned, edited_by_user").eq("trip_id", tripId);
    const keptAll = (keptRows ?? []).filter((r) => r.pinned || r.edited_by_user);
    const kept = keptAll.filter((r) => r.spot_id).map((r) => ({ spotId: r.spot_id as string, day: r.day as number }));
    const pinnedSpotIds = keptAll.filter((r) => r.pinned && r.spot_id).map((r) => r.spot_id as string);
    const { data: removedRows } = await service.from("removed_spots").select("spot_id").eq("trip_id", tripId);

    const spots = await loadSpots(service);
    const result = await createPlan({
      days: daysFor(trip.nights as Nights),
      paceAvg: agg.scale.pace?.avg ?? null,
      styleAvg: agg.scale.style?.avg ?? null,
      candidates,
      stats,
      spots: new Map(spots.map((s) => [s.id, s])),
      kept,
      pinnedSpotIds,
      removedSpotIds: (removedRows ?? []).map((r) => r.spot_id),
    });
    const items = result.plan.days.flatMap((d) => d.items.map((i) => ({ day: d.day, spot_id: i.spot_id, title: i.title, time_hint: i.time_hint, source: result.source })));
    const { error } = await service.rpc("save_plan", {
      p_trip_id: tripId,
      p_title: result.plan.title,
      p_source: result.source,
      p_reason: `${ratedCount}人目の回答で更新しました`,
      p_items: items,
      p_actor_member_id: memberId,
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("generatePlanAction", e);
    return { ok: false };
  }
}
