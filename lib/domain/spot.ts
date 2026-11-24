// 場所（spots テーブルの1行）のアプリ内での形。AIを使わない。
import type { SpotRow } from "@/lib/db/spot-schema";

export type Spot = {
  id: string;
  name: string;
  area: string;
  prefecture: string;
  region: string;
  category: string;
  tags: string[];
  seasonMonths: number[];
  description: string;
  address: string;
  hours: string;
  priceYen: number;
  durationMin: number;
  access: string;
  vibe: number | null;
  isPartner: boolean;
  lat: number | null;
  lng: number | null;
  /** 写真の URL。なければ null（色の背景にエリア名の代わりの画像を出す） */
  photo: string | null;
  /** 写真の撮影者名。不明なら空 */
  credit: string;
  /** 撮影者のページ（Unsplash）。不明なら空 */
  creditUrl: string;
  /** 写真すべて（M4 で横にスワイプして1〜3枚を見せる） */
  images: { url: string; credit: string; creditUrl: string }[];
};

export function spotFromRow(row: Partial<SpotRow> & { id: string; name: string }): Spot {
  const img = row.images?.[0];
  return {
    id: row.id,
    name: row.name,
    area: row.area ?? "",
    prefecture: row.prefecture ?? "",
    region: row.region ?? "",
    category: row.category ?? "",
    tags: row.tags ?? [],
    seasonMonths: row.season_months ?? [],
    description: row.description ?? "",
    address: row.address ?? "",
    hours: row.hours ?? "",
    priceYen: row.price_yen ?? 0,
    durationMin: row.duration_min ?? 0,
    access: row.access ?? "",
    vibe: row.vibe ?? null,
    isPartner: row.is_partner ?? false,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    photo: img?.url || null,
    credit: img?.credit ?? "",
    creditUrl: img?.credit_url ?? "",
    images: (row.images ?? []).filter((i) => i.url).slice(0, 3).map((i) => ({ url: i.url, credit: i.credit ?? "", creditUrl: i.credit_url ?? "" })),
  };
}

/** 「山形・銀山温泉」。県・府・都は取る（京都府→京都、東京都→東京、北海道はそのまま） */
export const prefectureShort = (p: string): string => p.replace(/[県府都]$/, "");
export const areaLabelOf = (s: Pick<Spot, "prefecture" | "area">): string => `${prefectureShort(s.prefecture)}・${s.area}`;
