// 仕様書「写真の用意の仕方」の2番目：UNSPLASH_ACCESS_KEY があれば、写真のない場所に Unsplash の写真を入れる。
// 使い方: node --env-file=.env.local scripts/fetch-images.ts   （キーが無ければ何もしない）
// 終わったら pnpm db:sql で seed の SQL を作り直す。
// TODO(spec): Unsplash の規約にある「ダウンロードの通知」は、写真を表示するだけの今は送っていない。公開前（段階7）に確かめる。
import { readFileSync, writeFileSync } from "node:fs";

const key = process.env.UNSPLASH_ACCESS_KEY;
if (!key) {
  console.log("UNSPLASH_ACCESS_KEY がないので、何もしません（写真は、色の背景にエリア名の代わりの画像になります）");
  process.exit(0);
}

type Img = { url: string; credit: string; credit_url: string };
type Spot = { id: string; area: string; category: string; images: Img[] };

const AREA_EN: Record<string, string> = {
  "hokkaido-otaru": "Otaru Hokkaido", "yamagata-ginzan": "Ginzan Onsen Yamagata", "yamagata-zao": "Zao Yamagata",
  "yamagata-yamadera": "Yamadera Yamagata", "kanagawa-hakone": "Hakone", "yamanashi-kawaguchiko": "Lake Kawaguchi",
  "nagano-shibu": "Shibu Onsen Nagano", "nagano-hakuba": "Hakuba Nagano", "ishikawa-kanazawa": "Kanazawa",
  "gifu-shirakawago": "Shirakawa-go", "kyoto-arashiyama": "Arashiyama Kyoto", "hyogo-kinosaki": "Kinosaki Onsen",
  "hiroshima-miyajima": "Miyajima Hiroshima", "fukuoka-itoshima": "Itoshima Fukuoka",
};
const CATEGORY_EN: Record<string, string> = {
  food: "japanese food", nature: "scenery", onsen: "onsen hot spring", activity: "experience", town: "town street", culture: "temple shrine", stay: "ryokan inn",
};

const path = "supabase/seed/spots.json";
const spots: Spot[] = JSON.parse(readFileSync(path, "utf8"));
for (const s of spots) {
  if (s.images.length > 0) continue;
  const area = AREA_EN[s.id.split("-").slice(0, 2).join("-")] ?? s.area;
  const query = encodeURIComponent(`${area} ${CATEGORY_EN[s.category] ?? ""}`.trim());
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!res.ok) {
    console.log(`${s.id}: 検索に失敗しました（${res.status}）`);
    continue;
  }
  const photo = (await res.json()).results?.[0];
  if (!photo) {
    console.log(`${s.id}: 見つかりませんでした`);
    continue;
  }
  s.images = [{ url: photo.urls.regular, credit: photo.user.name, credit_url: photo.user.links.html }];
  console.log(`${s.id}: ${photo.user.name}`);
}
writeFileSync(path, JSON.stringify(spots, null, 2) + "\n");
