"use client";

import { useState } from "react";

/** 写真。読み込めないときは淡い色の背景に名前を置く（仕様書「写真の用意の仕方」の3番目） */
export function Photo({ src, alt, label, className }: { src: string | null; alt: string; label?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`photo ${className ?? ""}`}>
      {failed || !src ? (
        <span className="photo-fallback">{label ?? alt}</span>
      ) : (
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      )}
    </div>
  );
}
