import type { SupabaseClient } from "@supabase/supabase-js";
import type { Companion, Nights } from "@/lib/domain/questions";
import { spotFromRow, type Spot } from "@/lib/domain/spot";

export type TripInfo = {
  id: string;
  code: string;
  ownerId: string;
  companion: Companion;
  months: number[];
  nights: Nights;
  origin: string | null;
  regions: string[];
  seedSpotId: string | null;
  status: "collecting" | "decided" | "done";
};

export type MemberInfo = {
  id: string;
  name: string;
  userId: string | null;
  isOwner: boolean;
  answeredAt: string | null;
  ratedAt: string | null;
};

type TripRow = {
  id: string; code: string; owner_id: string; companion: Companion; months: number[] | null; nights: Nights | null;
  origin: string | null; regions: string[] | null; seed_spot_id: string | null; status: TripInfo["status"];
};
type MemberRow = { id: string; name: string; user_id: string | null; is_owner: boolean | null; answered_at: string | null; rated_at: string | null; seq: number };

export const tripFromRow = (r: TripRow): TripInfo => ({
  id: r.id, code: r.code, ownerId: r.owner_id, companion: r.companion, months: r.months ?? [], nights: r.nights ?? "undecided",
  origin: r.origin, regions: r.regions ?? [], seedSpotId: r.seed_spot_id, status: r.status,
});
export const memberFromRow = (r: Omit<MemberRow, "seq"> & { seq?: number }): MemberInfo => ({
  id: r.id, name: r.name, userId: r.user_id, isOwner: Boolean(r.is_owner), answeredAt: r.answered_at, ratedAt: r.rated_at,
});

/** 旅とメンバー（作られた順）。メンバーでなければ null（RLS で読めない） */
export async function fetchTrip(client: SupabaseClient, tripId: string): Promise<{ trip: TripInfo; members: MemberInfo[] } | null> {
  const { data: t } = await client.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (!t) return null;
  const { data: ms } = await client.from("members").select("*").eq("trip_id", tripId).order("seq");
  return { trip: tripFromRow(t as TripRow), members: ((ms ?? []) as MemberRow[]).map(memberFromRow) };
}

/** 全56件（公開データ。ログイン前でも読める） */
export async function fetchAllSpots(client: SupabaseClient): Promise<Spot[]> {
  const { data } = await client.from("spots").select("*");
  return (data ?? []).map(spotFromRow);
}

export async function fetchSpot(client: SupabaseClient, id: string): Promise<Spot | null> {
  const { data } = await client.from("spots").select("*").eq("id", id).maybeSingle();
  return data ? spotFromRow(data) : null;
}

/** その人の、続きの画面（M2・F3 から入ったとき）。TODO(spec): 質問は、途中まで答えていても 1 問目から始める。 */
export function resumeHref(tripId: string, me: Pick<MemberInfo, "answeredAt" | "ratedAt">): string {
  if (!me.answeredAt) return `/trips/${tripId}/q/1`;
  if (!me.ratedAt) return `/trips/${tripId}/intro`;
  return `/trips/${tripId}/plan`;
}
