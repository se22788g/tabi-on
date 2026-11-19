// 問12「具体的に行きたい場所」：候補から選んだ場所（spot の id）と、自由入力した場所（{"text": "..."}）の扱い。
// 自由入力の場所は、ルールで spots のどれに近いかを当てる（AI版でも先に行う）。AIは使わない。
import type { Spot } from "./spot";
import { areaKeyOf } from "./travel";

/** answers.value：文字列は spot の id、オブジェクトは自由入力 */
export type PlaceEntry = string | { text: string };
export const isFreeText = (e: unknown): e is { text: string } => typeof e === "object" && e !== null && typeof (e as { text?: unknown }).text === "string";

/** 自由入力は、30字まで、5件まで */
export const MAX_FREE_TEXT_LEN = 30;
export const MAX_FREE_TEXTS = 5;

/** 入力した文字から、空白と記号を除く（全角・半角も、そろえる） */
export const normalizePlaceText = (s: string): string => s.normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "").toLowerCase();

/** 都道府県 → 地域（spots.region と同じ値） */
export const PREFECTURE_REGION: Record<string, string> = {
  北海道: "hokkaido",
  青森県: "tohoku", 岩手県: "tohoku", 宮城県: "tohoku", 秋田県: "tohoku", 山形県: "tohoku", 福島県: "tohoku",
  茨城県: "kanto", 栃木県: "kanto", 群馬県: "kanto", 埼玉県: "kanto", 千葉県: "kanto", 東京都: "kanto", 神奈川県: "kanto", 山梨県: "kanto",
  新潟県: "chubu", 富山県: "chubu", 石川県: "chubu", 福井県: "chubu", 長野県: "chubu", 岐阜県: "chubu", 静岡県: "chubu", 愛知県: "chubu",
  三重県: "kansai", 滋賀県: "kansai", 京都府: "kansai", 大阪府: "kansai", 兵庫県: "kansai", 奈良県: "kansai", 和歌山県: "kansai",
  鳥取県: "chugoku_shikoku", 島根県: "chugoku_shikoku", 岡山県: "chugoku_shikoku", 広島県: "chugoku_shikoku", 山口県: "chugoku_shikoku",
  徳島県: "chugoku_shikoku", 香川県: "chugoku_shikoku", 愛媛県: "chugoku_shikoku", 高知県: "chugoku_shikoku",
  福岡県: "kyushu", 佐賀県: "kyushu", 長崎県: "kyushu", 熊本県: "kyushu", 大分県: "kyushu", 宮崎県: "kyushu", 鹿児島県: "kyushu", 沖縄県: "kyushu",
};

const shortPref = (p: string) => (p === "北海道" ? p : p.replace(/[県府都]$/, ""));

/**
 * 主な地名 → 都道府県（地域は、都道府県から決まる）。
 * TODO(spec): 「都道府県名・主な地名の対応表」の中身は仕様書にない。観光でよく挙がる地名を、仮に入れた。足りない地名は、ここに足す。
 */
export const PLACE_KEYWORDS: Record<string, string> = {
  // 北海道
  札幌: "北海道", 函館: "北海道", 富良野: "北海道", 美瑛: "北海道", 知床: "北海道", 旭川: "北海道", 登別: "北海道", 洞爺: "北海道", 釧路: "北海道", 網走: "北海道", ニセコ: "北海道", 利尻: "北海道", 阿寒: "北海道",
  // 東北
  仙台: "宮城県", 松島: "宮城県", 平泉: "岩手県", 盛岡: "岩手県", 十和田: "青森県", 弘前: "青森県", 白神: "青森県", 角館: "秋田県", 乳頭: "秋田県", 会津: "福島県", 喜多方: "福島県", 磐梯: "福島県", 立石寺: "山形県", 酒田: "山形県", 鶴岡: "山形県",
  // 関東
  鎌倉: "神奈川県", 横浜: "神奈川県", 江の島: "神奈川県", 日光: "栃木県", 那須: "栃木県", 草津: "群馬県", 伊香保: "群馬県", 水戸: "茨城県", 川越: "埼玉県", 浅草: "東京都", 渋谷: "東京都", 新宿: "東京都", 高尾山: "東京都", 富士山: "山梨県", 富士五湖: "山梨県",
  // 中部
  軽井沢: "長野県", 上高地: "長野県", 松本: "長野県", 善光寺: "長野県", 立山: "富山県", 黒部: "富山県", 五箇山: "富山県", 能登: "石川県", 輪島: "石川県", 兼六園: "石川県", 高山: "岐阜県", 下呂: "岐阜県", 名古屋: "愛知県", 犬山: "愛知県", 熱海: "静岡県", 伊豆: "静岡県", 浜松: "静岡県", 佐渡: "新潟県", 越後湯沢: "新潟県", 永平寺: "福井県", 東尋坊: "福井県",
  // 関西
  熊野: "和歌山県", 高野山: "和歌山県", 白浜: "和歌山県", 伊勢: "三重県", 志摩: "三重県", 鳥羽: "三重県", 奈良: "奈良県", 吉野: "奈良県", 琵琶湖: "滋賀県", 彦根: "滋賀県", 京都: "京都府", 清水寺: "京都府", 伏見: "京都府", 天橋立: "京都府", 大阪: "大阪府", 道頓堀: "大阪府", 神戸: "兵庫県", 姫路: "兵庫県", 有馬: "兵庫県", 淡路: "兵庫県",
  // 中国・四国
  出雲: "島根県", 石見銀山: "島根県", 鳥取砂丘: "鳥取県", 倉敷: "岡山県", 直島: "香川県", 高松: "香川県", 厳島: "広島県", 尾道: "広島県", しまなみ: "愛媛県", 松山: "愛媛県", 道後: "愛媛県", 祖谷: "徳島県", 鳴門: "徳島県", 四万十: "高知県", 萩: "山口県", 下関: "山口県",
  // 九州・沖縄
  博多: "福岡県", 太宰府: "福岡県", 柳川: "福岡県", 長崎: "長崎県", 軍艦島: "長崎県", 阿蘇: "熊本県", 黒川温泉: "熊本県", 別府: "大分県", 由布院: "大分県", 湯布院: "大分県", 高千穂: "宮崎県", 屋久島: "鹿児島県", 桜島: "鹿児島県", 指宿: "鹿児島県", 那覇: "沖縄県", 石垣: "沖縄県", 宮古島: "沖縄県", 西表: "沖縄県",
};

const contains = (a: string, b: string) => a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a));

export type FreeTextMatch = {
  /** 場所の名前・エリアに一致した spot（「追加された spot」と同じに扱う） */
  strong: Spot[];
  /** 都道府県・tags に一致した spot（そのエリアの点数を上げる） */
  weak: Spot[];
  /** 都道府県名・主な地名から当てた地域（spots.region の値） */
  regions: string[];
};

/**
 * 自由入力の文字を、spots の name・area・prefecture・tags と部分一致（どちらの向きも）で照らす。
 * 一致しないときは、都道府県名・主な地名の対応表で地域を当てる。どれにも当たらなくても、空の結果を返す（捨てない。呼ぶ側が工程案に入れる）。
 * TODO(spec): 一致の強さ。仕様書は「一致した spot とそのエリアは、追加された spot と同じ」としているが、tags の一致（例：入力「温泉めぐり」と tag「温泉」）は
 * 何件も当たるため、name・area の一致だけを「追加された spot」と同じ（必ず1件に入れる）にし、都道府県・tags の一致は、そのエリアの点数を上げるだけにした。
 */
export function matchFreeText(text: string, spots: Spot[]): FreeTextMatch {
  const n = normalizePlaceText(text);
  const strong: Spot[] = [];
  const weak: Spot[] = [];
  const regions = new Set<string>();
  if (n.length === 0) return { strong, weak, regions: [] };
  for (const s of spots) {
    const pref = normalizePlaceText(s.prefecture);
    if (contains(n, normalizePlaceText(s.name)) || contains(n, normalizePlaceText(s.area))) strong.push(s);
    else if (contains(n, pref) || contains(n, normalizePlaceText(shortPref(s.prefecture))) || s.tags.some((t) => contains(n, normalizePlaceText(t)))) weak.push(s);
  }
  for (const [pref, region] of Object.entries(PREFECTURE_REGION)) {
    if (contains(n, normalizePlaceText(pref)) || contains(n, normalizePlaceText(shortPref(pref)))) regions.add(region);
  }
  for (const [word, pref] of Object.entries(PLACE_KEYWORDS)) {
    if (n.includes(normalizePlaceText(word))) regions.add(PREFECTURE_REGION[pref]);
  }
  for (const s of strong) regions.add(s.region);
  return { strong, weak, regions: [...regions] };
}

/** 一致した spot のエリアキー */
export const areaOf = (s: Spot): string => areaKeyOf(s.id) ?? s.id;
