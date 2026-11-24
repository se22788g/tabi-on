// 写真の URL と、出典（Unsplash の規約）の組み立て。画面に依存しない。

/** Unsplash の API の規約：リンクには、アプリ名の utm パラメータを付ける */
export const UTM = "utm_source=tabi-on&utm_medium=referral";

/** ?utm_… を付ける（すでに ? があれば &）。すでに utm_source が付いていれば、そのまま */
export function withUtm(url: string): string {
  if (!url || /[?&]utm_source=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${UTM}`;
}

export const UNSPLASH_HOME = "https://unsplash.com/";

/**
 * 表示する大きさに合わせて、Unsplash の画像 URL の幅（w）を変える。
 * Unsplash の規約：API が返した URL を、そのまま埋め込む（ダウンロードして自分で配らない）。大きさを変えるのはよいが、
 * ixid などのパラメータは消さない。このため、w 以外には触れない（w がなければ足す）。Unsplash 以外の URL は、そのまま返す。
 */
export function sizedUrl(url: string, width: number): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "images.unsplash.com") return url;
    u.searchParams.set("w", String(Math.round(width)));
    return u.toString();
  } catch {
    return url;
  }
}

/** M4 の写真の下の出典「Photo: {撮影者} / Unsplash」の、2つのリンク。撮影者が不明（空）なら null */
export function creditLinks(credit: string, creditUrl: string): { name: string; photographerUrl: string; unsplashUrl: string } | null {
  if (!credit) return null;
  return {
    name: credit,
    photographerUrl: creditUrl ? withUtm(creditUrl) : withUtm(UNSPLASH_HOME),
    unsplashUrl: withUtm(UNSPLASH_HOME),
  };
}
