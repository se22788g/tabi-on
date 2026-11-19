// 「友だちに送る」。Web Share API が使えなければ LINE の共有URLを開く（仕様書 M5）。
export async function sendToFriend(args: { title: string; text: string; url: string }): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share(args);
      return true;
    }
  } catch {
    return false; // 送るのをやめた
  }
  const text = `${args.title}\n${args.text}\n${args.url}`;
  window.open(`https://line.me/R/share?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  return true;
}
