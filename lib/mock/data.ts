// 段階1用の仮のデータ。段階2以降でSupabaseから読む形に置き換える。
// 写真は docs/figma-make のコードで使っているもの（仕様書「写真の用意の仕方」の1番目）。

const u = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=${w}`;

export const MOCK_TRIP_ID = "demo";
export const MOCK_CODE = "TABI-4K7Q";

export const RATING_NAMES = ["行きたくない", "あまり", "どちらでもない", "行きたい", "すごく行きたい"] as const;
export type RatingLevel = 0 | 1 | 2 | 3 | 4;

export type MockSpot = {
  id: string;
  name: string;
  area: string;
  prefecture: string;
  photo: string;
  alt: string;
  description: string;
  tags: string[];
  address: string;
  hours: string;
  priceYen: number;
  durationMin: number;
  access: string;
  isPartner: boolean;
  lat: number;
  lng: number;
};

export const SPOTS: MockSpot[] = [
  {
    id: "yamagata-ginzan-yukimi-buro",
    name: "雪見露天の宿 しろがね荘",
    area: "銀山温泉",
    prefecture: "山形県",
    photo: u("photo-1517918558653-3a2c5ab393a2"),
    alt: "雪に包まれた日本の木造家屋",
    description: "川沿いに立つ木造の小さな宿。雪を眺めながら入れる貸切の露天風呂があり、友人同士でゆっくり話したい夜に向いています。",
    tags: ["温泉", "雪景色", "友人"],
    address: "山形県尾花沢市銀山新畑 99-1（架空）",
    hours: "チェックイン 15:00 / アウト 10:00",
    priceYen: 22000,
    durationMin: 960,
    access: "JR大石田駅からバスで約40分",
    isPartner: false,
    lat: 38.5713,
    lng: 140.5301,
  },
  {
    id: "yamagata-zao-juhyo-snowshoe",
    name: "樹氷の森スノーシュー体験",
    area: "蔵王",
    prefecture: "山形県",
    photo: u("photo-1673751243582-6d3d33cf136d"),
    alt: "雪に覆われた木々と静かな公園",
    description: "ガイドと一緒に樹氷のあいだを歩く約2時間の体験。道具はすべて借りられるので、雪山がはじめてでも参加できます。",
    tags: ["雪景色", "体験", "絶景"],
    address: "山形県山形市蔵王温泉 1200-5（架空）",
    hours: "9:30 / 13:00 の1日2回",
    priceYen: 6800,
    durationMin: 120,
    access: "蔵王温泉バスターミナルから徒歩約10分",
    isPartner: true,
    lat: 38.1697,
    lng: 140.4184,
  },
  {
    id: "yamagata-yamadera-ishidan",
    name: "雪の石段 朝のぼり",
    area: "山寺",
    prefecture: "山形県",
    photo: u("photo-1610623757180-f5ec7090a07f"),
    alt: "雪に囲まれた赤い寺院",
    description: "朝いちばんの静かな石段をのぼる散歩コース。雪の積もった境内を、ゆっくり歩きたい人に向いています。",
    tags: ["雪景色", "歴史", "朝旅"],
    address: "山形県山形市山寺 4456（架空）",
    hours: "6:00〜17:00",
    priceYen: 500,
    durationMin: 90,
    access: "JR山寺駅から徒歩約5分",
    isPartner: false,
    lat: 38.3128,
    lng: 140.4372,
  },
  {
    id: "nagano-shibu-sotoyu",
    name: "九つの外湯めぐり",
    area: "渋温泉",
    prefecture: "長野県",
    photo: u("photo-1673751243256-d744af8a4dda"),
    alt: "雪をまとった木と冬の建物",
    description: "石畳の温泉街を歩きながら、小さな外湯を順番にめぐります。浴衣で歩く夜の街並みも楽しめます。",
    tags: ["温泉", "街歩き", "友人"],
    address: "長野県下高井郡山ノ内町 渋 2100（架空）",
    hours: "6:00〜22:00",
    priceYen: 1500,
    durationMin: 180,
    access: "長野電鉄湯田中駅からバスで約10分",
    isPartner: false,
    lat: 36.7448,
    lng: 138.4276,
  },
  {
    id: "yamanashi-kawaguchiko-fuji-cafe",
    name: "富士を望む湖畔カフェ",
    area: "河口湖",
    prefecture: "山梨県",
    photo: u("photo-1528164344705-47542687000d"),
    alt: "富士山と五重塔を望む景色",
    description: "大きな窓から冬の富士山が見えるカフェ。ひとりでも、友人とのおしゃべりにも向いています。",
    tags: ["絶景", "カフェ", "ひとり旅"],
    address: "山梨県南都留郡富士河口湖町 船津 800（架空）",
    hours: "9:00〜17:00（水曜定休）",
    priceYen: 1200,
    durationMin: 60,
    access: "富士急行河口湖駅から徒歩約12分",
    isPartner: false,
    lat: 35.5127,
    lng: 138.7637,
  },
  {
    id: "hiroshima-miyajima-torii-kayak",
    name: "鳥居をめぐる朝のカヤック",
    area: "宮島",
    prefecture: "広島県",
    photo: u("photo-1693246049389-9fecc67938c1"),
    alt: "水辺に立つ大きな木造の鳥居",
    description: "朝の穏やかな海を、ガイドと一緒に漕ぎ進みます。海に立つ鳥居を近くで見られる、約2時間の体験です。",
    tags: ["島", "体験", "朝旅"],
    address: "広島県廿日市市宮島町 300-2（架空）",
    hours: "8:00 / 10:30 の1日2回",
    priceYen: 7200,
    durationMin: 120,
    access: "宮島桟橋から徒歩約8分",
    isPartner: true,
    lat: 34.2961,
    lng: 132.3198,
  },
];

export const spotById = (id: string): MockSpot | undefined => SPOTS.find((s) => s.id === id);

export type MockCandidate = {
  id: string;
  areaLabel: string;
  title: string;
  tags: string[];
  price: string;
  time: string;
  spotIds: string[];
  partner: boolean;
};

export const CANDIDATES: MockCandidate[] = [
  {
    id: "c1",
    areaLabel: "山形・銀山温泉",
    title: "雪と温泉と、ごはんの旅",
    tags: ["温泉", "雪景色", "郷土料理"],
    price: "約28,000円",
    time: "東京から約3時間30分",
    spotIds: ["yamagata-ginzan-yukimi-buro", "yamagata-yamadera-ishidan"],
    partner: false,
  },
  {
    id: "c2",
    areaLabel: "山形・蔵王",
    title: "樹氷の中を歩く、冬の冒険",
    tags: ["樹氷", "雪あそび", "絶景"],
    price: "約31,000円",
    time: "東京から約3時間",
    spotIds: ["yamagata-zao-juhyo-snowshoe", "yamagata-ginzan-yukimi-buro"],
    partner: true,
  },
  {
    id: "c3",
    areaLabel: "長野・渋温泉",
    title: "九つの外湯をめぐる温泉街",
    tags: ["温泉", "街歩き", "友人"],
    price: "約25,000円",
    time: "東京から約3時間",
    spotIds: ["nagano-shibu-sotoyu", "yamanashi-kawaguchiko-fuji-cafe"],
    partner: false,
  },
  {
    id: "c4",
    areaLabel: "山梨・河口湖",
    title: "冬の富士山を眺める週末",
    tags: ["絶景", "カフェ", "ひとり旅"],
    price: "約18,000円",
    time: "東京から約2時間",
    spotIds: ["yamanashi-kawaguchiko-fuji-cafe", "nagano-shibu-sotoyu"],
    partner: false,
  },
  {
    id: "c5",
    areaLabel: "広島・宮島",
    title: "海に浮かぶ鳥居と冬の島旅",
    tags: ["島", "文化", "食べる"],
    price: "約36,000円",
    time: "東京から約4時間30分",
    spotIds: ["hiroshima-miyajima-torii-kayak", "yamagata-yamadera-ishidan"],
    partner: true,
  },
];

export type MockHomeCard = {
  spotId: string;
  label: "いまが見頃" | "あなたへのおすすめ" | "みんなの行きたいが重なった場所";
  title: string;
  invite: string;
};

export const HOME_CARDS: MockHomeCard[] = [
  {
    spotId: "yamagata-ginzan-yukimi-buro",
    label: "いまが見頃",
    title: "雪明かりの温泉街へ",
    invite: "気になる人を、気軽に誘ってみませんか。",
  },
  {
    spotId: "yamagata-zao-juhyo-snowshoe",
    label: "あなたへのおすすめ",
    title: "樹氷の森を歩く冬旅",
    invite: "ひとりで考えはじめて、あとから誘えます。",
  },
  {
    spotId: "nagano-shibu-sotoyu",
    label: "みんなの行きたいが重なった場所",
    title: "湯けむりの外湯めぐり",
    invite: "いつもの仲間とも、新しい人とも行けそうです。",
  },
];

export type MockWishRow = { spotId: string; detail: string; tags: string[] };

export const WISH_ROWS: MockWishRow[] = [
  { spotId: "yamagata-yamadera-ishidan", detail: "東京から約3時間30分・日帰りから", tags: ["雪景色", "歴史", "朝旅"] },
  { spotId: "nagano-shibu-sotoyu", detail: "東京から約3時間・1泊がおすすめ", tags: ["温泉", "街歩き", "友人"] },
  { spotId: "yamanashi-kawaguchiko-fuji-cafe", detail: "東京から約2時間・日帰りから", tags: ["絶景", "カフェ", "ひとり旅"] },
  { spotId: "hiroshima-miyajima-torii-kayak", detail: "東京から約4時間30分・1泊から", tags: ["島", "体験", "朝旅"] },
];

export type MockPlanItem = {
  id: string;
  day: number;
  spotId: string;
  title: string;
  timeHint: string;
  /** 一人ずつの行きたい度合い（高い順、名前なし） */
  levels: RatingLevel[];
  pinned: boolean;
  /** 並べ替え・追加・日の移動をしたら true。あとから AI が作り直しても動かさない（段階5のA2で使う） */
  editedByUser?: boolean;
};

export const PLAN_TITLE = "冬の山形、温泉と雪景色";

export const PLAN_ITEMS: MockPlanItem[] = [
  { id: "p1", day: 1, spotId: "yamagata-zao-juhyo-snowshoe", title: "蔵王の樹氷を見に行く", timeHint: "11:00", levels: [4, 3, 3], pinned: true },
  { id: "p2", day: 1, spotId: "yamagata-yamadera-ishidan", title: "雪の石段をのぼる", timeHint: "14:00", levels: [3, 3, 2], pinned: false },
  { id: "p3", day: 1, spotId: "yamagata-ginzan-yukimi-buro", title: "雪見露天風呂で夕べの湯", timeHint: "17:00", levels: [4, 4, 3], pinned: false },
  { id: "p4", day: 2, spotId: "yamagata-ginzan-yukimi-buro", title: "雪見露天風呂で朝湯", timeHint: "09:00", levels: [4, 4, 3], pinned: false },
  { id: "p5", day: 2, spotId: "nagano-shibu-sotoyu", title: "湯けむりの街をそぞろ歩き", timeHint: "11:30", levels: [3, 2, 2], pinned: false },
];

export type MockTrip = {
  id: string;
  title: string | null;
  condition: string;
  members: string[];
  status: "collecting" | "decided" | "done";
  chip: string;
  /** 自分が回答し終えていないとき、続きの画面 */
  resumeHref: string | null;
};

export const TRIPS: MockTrip[] = [
  {
    id: "demo",
    title: PLAN_TITLE,
    condition: "1〜2月・1泊",
    members: ["わたし", "あや", "みさき", "けんた"],
    status: "collecting",
    chip: "4人中3人が回答",
    resumeHref: null,
  },
  {
    id: "demo2",
    title: null,
    condition: "3月・日帰り",
    members: ["わたし", "ゆうこ"],
    status: "collecting",
    chip: "あなたの回答待ち",
    resumeHref: "/trips/demo2/q/1",
  },
  {
    id: "demo3",
    title: "秋の京都、紅葉さんぽ",
    condition: "11月・2泊",
    members: ["わたし", "あや", "けんた"],
    status: "decided",
    chip: "決定",
    resumeHref: null,
  },
  {
    id: "demo4",
    title: "宮島、海と鳥居の島旅",
    condition: "9月・1泊",
    members: ["わたし", "みさき"],
    status: "done",
    chip: "決定",
    resumeHref: null,
  },
];

export const VISITED = [
  { spotId: "hiroshima-miyajima-torii-kayak", date: "2026年9月14日", again: true },
  { spotId: "yamanashi-kawaguchiko-fuji-cafe", date: "2026年6月2日", again: false },
];

export const MEMBER_STATUS: { name: string; status: "まだ" | "回答中" | "回答済み" }[] = [
  { name: "あなた", status: "回答中" },
  { name: "あや", status: "回答済み" },
  { name: "みさき", status: "まだ" },
  { name: "けんた", status: "まだ" },
];

export const WANTS_TREND = [
  { label: "温泉・いやし", tone: "hot" },
  { label: "自然・景色", tone: "warm" },
  { label: "食べる", tone: "mid" },
  { label: "歴史・文化", tone: "cool" },
  { label: "街歩き・買い物", tone: "cold" },
] as const;

export const PREFERENCE_BARS = [
  { title: "旅のペース", left: "ゆったり", right: "アクティブ", position: 0.5, word: "バランス派", count: 12 },
  { title: "過ごし方", left: "予定少なめ", right: "ぎっしり", position: 0.7, word: "少し充実させたい", count: 12 },
  { title: "移動", left: "短めがいい", right: "遠くてもOK", position: 0.7, word: "遠出も楽しめる", count: 12 },
  { title: "行き先", left: "定番", right: "穴場", position: 0.85, word: "まだ知らない場所へ", count: 12 },
  { title: "予算", left: "おさえたい", right: "少し贅沢", position: 0, word: "", count: 1 },
] as const;

export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
  "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
  "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

import type { TripConditions } from "@/lib/domain/questions";

// 段階1：旅の条件は仮の固定値。段階3でDBから読む。
export const MOCK_CONDITIONS: TripConditions = { companion: "friends", months: [1, 2], nights: "1" };
export const MOCK_MEMBER_COUNT = 4;
