import { z } from "zod";

export const REGIONS = ["hokkaido", "tohoku", "kanto", "chubu", "kansai", "chugoku_shikoku", "kyushu"] as const;
export const CATEGORIES = ["food", "nature", "onsen", "activity", "town", "culture", "stay"] as const;
/** 仕様書「1件の書き方の決まり」のタグ */
export const SPOT_TAGS = [
  "温泉", "雪景色", "絶景", "歴史", "郷土料理", "海鮮", "カフェ", "街歩き", "体験", "ひとり旅", "友人", "家族", "朝旅", "夜景", "島", "アート",
] as const;

/** id・download_location・tracked は、Unsplash の写真だけ（ダウンロードの通知を、1回だけ送るための印） */
export const spotImageSchema = z.object({
  url: z.string().url(),
  credit: z.string(),
  credit_url: z.string(),
  id: z.string().optional(),
  download_location: z.string().url().optional(),
  tracked: z.boolean().optional(),
});

/** supabase/seed/spots.json の1件（= spots テーブルの1行） */
export const spotSchema = z.object({
  id: z.string().regex(/^[a-z]+(-[a-z0-9]+)+$/),
  name: z.string().min(1).max(20),
  area: z.string().min(1),
  prefecture: z.string().min(1),
  region: z.enum(REGIONS),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  category: z.enum(CATEGORIES),
  tags: z.array(z.enum(SPOT_TAGS)).min(2).max(4),
  season_months: z.array(z.number().int().min(1).max(12)).min(1),
  description: z.string().min(1).max(90),
  address: z.string().nullable(),
  hours: z.string().nullable(),
  price_yen: z.number().int().min(0).nullable(),
  duration_min: z.number().int().min(0).nullable(),
  access: z.string().nullable(),
  vibe: z.number().int().min(1).max(5).nullable(),
  is_partner: z.boolean(),
  images: z.array(spotImageSchema),
  is_fictional: z.boolean(),
});
export type SpotRow = z.infer<typeof spotSchema>;
