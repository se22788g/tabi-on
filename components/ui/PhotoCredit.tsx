import { creditLinks } from "@/lib/image-url";

/**
 * 写真の出典「Photo: {撮影者} / Unsplash」。Unsplash の規約：撮影者と Unsplash の両方を、
 * utm_source=tabi-on&utm_medium=referral 付きのリンクにする。撮影者が分からない写真には出さない。
 */
export function PhotoCredit({ credit, creditUrl, className = "sub min" }: { credit: string; creditUrl?: string; className?: string }) {
  const l = creditLinks(credit, creditUrl ?? "");
  if (!l) return null;
  return (
    <p className={className} style={{ marginTop: 6 }}>
      Photo:{" "}
      <a href={l.photographerUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
        {l.name}
      </a>{" "}
      /{" "}
      <a href={l.unsplashUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
        Unsplash
      </a>
    </p>
  );
}
