import type { MetadataRoute } from "next";

/**
 * PWA の manifest。ホーム画面に追加すると、アプリのように開く（アドレスバーなし）。
 * TODO(spec): オフライン対応（service worker）は仕様書にないので作っていない。アイコンは 96px の元画像から拡大したもので、
 * 高解像度の元画像ができたら、public/icons/ を差し替える。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "たびおん",
    short_name: "たびおん",
    description: "みんなの「行きたい」と「したい」から、旅が決まる。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ja",
    background_color: "#F6F4FD",
    theme_color: "#F6F4FD",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
