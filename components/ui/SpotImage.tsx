"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sizedUrl } from "@/lib/image-url";

/**
 * 場所の写真を出す、たった1つの部品（仕様書「写真を出す場所の決まり」）。画面ごとに別々に作らない。
 * ここにまとめているもの：縦横比（先に決めて、読み込みで位置がずれない）、角の丸み、読み込み中の色、
 * 読み込めないとき・写真がないときの代わりの画像、alt（場所名）、遅延読み込み。
 *
 * ・variant="spot"：その場所の写真。なければ、category ごとの淡い色の背景に、エリア名を置いた代わりの画像。
 * ・variant="free"：サイトにない場所（問12の自由入力）。写真がないので、ピンのアイコンを置いた淡い色の代わりの画像を出し、
 *   写真があるように見せない（alt は空、読み上げの対象から外す）。
 */
export type SpotImageProps = {
  /** 写真の URL（Unsplash の URL をそのまま）。なければ null */
  src?: string | null;
  /** 場所名（alt になる） */
  name: string;
  /** 代わりの画像に出す、エリア名 */
  area?: string;
  /** 代わりの画像の色を決める category（food / nature / onsen / activity / town / culture / stay） */
  category?: string;
  /** 縦横比。"fill" は、親が大きさを決める（64px 四角など） */
  aspect?: "16/10" | "16/9" | "1/1" | "fill";
  /** 画面の何pxで出すか。この2倍の幅で、写真を読み込む */
  displayWidth?: number;
  variant?: "spot" | "free";
  className?: string;
  /** 先頭の画面いっぱいの写真など、すぐ見えるものは true（遅延読み込みをしない） */
  eager?: boolean;
};

export function SpotImage({ src, name, area, category, aspect = "16/10", displayWidth = 400, variant = "spot", className = "", eager = false }: SpotImageProps) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">(src ? "loading" : "failed");
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setState(src ? "loading" : "failed");
  }, [src]);
  useEffect(() => {
    // 画面に出る前に、読み込みが終わっていた（成功・失敗とも）ときの、取りこぼしを拾う
    const el = ref.current;
    if (el?.complete) setState(el.naturalWidth > 0 ? "loaded" : "failed");
  }, [src]);

  const style = aspect === "fill" ? undefined : { aspectRatio: aspect.replace("/", " / ") };

  if (variant === "free") {
    return (
      <div className={`spot-image free ${className}`} style={style} aria-hidden="true" data-state="placeholder">
        <MapPin size={24} strokeWidth={2} />
      </div>
    );
  }

  return (
    <div className={`spot-image cat-${category ?? "none"} ${className}`} style={style} data-state={state}>
      {state === "failed" ? (
        // 代わりの画像：category ごとの淡い色の背景に、エリア名
        <span className="spot-image-fallback" role="img" aria-label={name}>
          {area ?? name}
        </span>
      ) : (
        <img
          ref={ref}
          src={sizedUrl(src as string, displayWidth * 2)}
          alt={name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
        />
      )}
    </div>
  );
}
