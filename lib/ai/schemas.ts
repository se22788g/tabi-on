// AIの出力のスキーマ（仕様書「AI機能の仕様」）。AIは必ずツール呼び出しで返し、返ってきた値をこれで検査する。
// 段階3では、ルール版の出力を同じ形に揃えるために使う。AIをつなぐのは段階5。
import { z } from "zod";

export const candidatesOutputSchema = z.object({
  candidates: z
    .array(
      z.object({
        title: z.string().max(20),
        area_label: z.string().max(14),
        spot_ids: z.array(z.string()).min(2).max(4),
        tags: z.array(z.string()).min(2).max(3),
        reason: z.string().max(40),
      }),
    )
    .min(3)
    .max(5),
});

export const planOutputSchema = z.object({
  title: z.string().max(16),
  days: z.array(
    z.object({
      day: z.number().int().min(1),
      items: z
        .array(z.object({ spot_id: z.string(), title: z.string().max(18), time_hint: z.string().regex(/^\d{2}:\d{2}$/) }))
        .min(1)
        .max(5),
    }),
  ),
});
