"use client";

import { ArrowDown, ArrowRight, ArrowUp, GripVertical, MoreHorizontal, Pin, Plus, Share2, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { AiBadge, PartnerBadge } from "@/components/ui/badges";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton, SecondaryButton, TextLink } from "@/components/ui/buttons";
import { LevelDot } from "@/components/ui/choices";
import { Loading, SetupNotice } from "@/components/ui/Loading";
import { PhotoCredit } from "@/components/ui/PhotoCredit";
import { SpotImage } from "@/components/ui/SpotImage";
import { fetchAllSpots } from "@/lib/db/queries";
import { useTripRealtime } from "@/lib/db/use-trip-realtime";
import { useSupabase } from "@/lib/db/use-supabase";
import { daysFor } from "@/lib/domain/plan-rules";
import type { Companion, Nights } from "@/lib/domain/questions";
import type { Spot } from "@/lib/domain/spot";
import { RATING_NAMES } from "@/lib/domain/ratings";
import { sendToFriend } from "@/lib/share";

/** Realtime が届かないときの、念のための読み直し */
const SAFETY_POLL_MS = 30000;
const TOUCH_DELAY_MS = 1000;
const UNDO_MS = 5000;

type PlanItem = {
  id: string;
  day: number;
  position: number;
  spotId: string | null;
  title: string;
  timeHint: string | null;
  pinned: boolean;
  edited: boolean;
  source: string;
  /** 一人ずつの行きたい度合い（高い順、名前なし）。自分が選ぶ前は空 */
  levels: number[];
  /** みんなの平均。自分が選ぶ前は null */
  avg: number | null;
};

type View = {
  trip: { id: string; code: string; companion: Companion; status: string; months: number[]; nights: Nights; origin: string | null };
  plan: { version: number; title: string; source: string; updated_reason: string | null } | null;
  me: { member_id: string; rated_at: string | null; last_seen_plan_version: number } | null;
  member_total: number;
  rated_count: number;
  items: {
    id: string; day: number; position: number; spot_id: string | null; title: string; time_hint: string | null; pinned: boolean;
    edited_by_user: boolean; source: string; avg: number | null; levels: number[];
  }[];
  candidate_spots: { spot_id: string; avg: number | null }[];
};

const toItem = (i: View["items"][number]): PlanItem => ({
  id: i.id, day: i.day, position: i.position, spotId: i.spot_id, title: i.title, timeHint: i.time_hint, pinned: i.pinned,
  edited: i.edited_by_user, source: i.source, levels: i.levels, avg: i.avg,
});
const byOrder = (a: PlanItem, b: PlanItem) => a.day - b.day || a.position - b.position || a.id.localeCompare(b.id);

const hhmm = (t: string | null) => (t ?? "").replace(/^0/, "");
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** TODO(spec): 本来は移動時間の表から振る。いまは、その日の最後の時刻の2時間後（21:00まで）にする */
const timeAfterLast = (list: PlanItem[]) => {
  const times = list.map((i) => i.timeHint).filter((t): t is string => Boolean(t));
  return fromMin(Math.min(21 * 60, (times.length ? Math.max(...times.map(toMin)) : 8 * 60) + 120));
};

type Removed = { item: PlanItem };

/** つかんで上下に動かせる予定カード。つまみは左端、「…」は右上 */
function PlanCard({
  item,
  solo,
  spot,
  onOpen,
  onMenu,
  onDragStart,
  onDragEnd,
}: {
  item: PlanItem;
  solo: boolean;
  /** その場所（サイトにない場所は null） */
  spot: Spot | null;
  onOpen: () => void;
  onMenu: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="div"
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`plan-item ${item.pinned ? "pinned" : ""}`}
      whileDrag={{ scale: 1.02, boxShadow: "0 10px 28px rgba(60, 40, 90, 0.22)", zIndex: 5 }}
    >
      <button type="button" className="grip" aria-label="並べ替えのつまみ。上下にドラッグします" onPointerDown={(e) => controls.start(e)}>
        <GripVertical size={20} strokeWidth={2} aria-hidden="true" />
      </button>
      <button type="button" className="main" onClick={onOpen}>
        {/* 左に正方形の小さな写真（64px）。サイトにない場所は、写真があるように見せない代わりの画像（ピンのアイコン） */}
        {item.spotId === null ? (
          <SpotImage variant="free" name={item.title} aspect="fill" className="plan-thumb" />
        ) : (
          <SpotImage src={spot?.photo ?? null} name={spot?.name ?? item.title} area={spot?.area} category={spot?.category} aspect="fill" displayWidth={64} className="plan-thumb" />
        )}
        {/* みんなの平均の色の小さな丸は、写真の左上に重ねる */}
        {item.spotId !== null && item.avg !== null && (
          <span className="heat" aria-hidden="true">
            <LevelDot level={item.avg} size={12} />
          </span>
        )}
        <span className="plan-text">
        {item.pinned && (
          <span className="pin-label">
            <Pin size={13} strokeWidth={2} aria-hidden="true" />
            絶対行く
          </span>
        )}
        <b>{item.title}</b>
        <span className="sub min">{item.timeHint ? `${hhmm(item.timeHint)}ごろ・` : ""}{spot ? spot.name : "サイトにない場所"}</span>
        {!solo && item.spotId !== null && item.levels.length > 0 && (
          <span className="responses" aria-label="みんなの行きたい度合い">
            <span>みんな</span>
            {item.levels.map((l, i) => (
              <i key={i} className={`bg-rate rate-${l}`} />
            ))}
          </span>
        )}
        </span>
      </button>
      <button type="button" className="icon-btn more" style={{ background: "transparent", border: 0 }} aria-label="予定のメニュー" onClick={onMenu}>
        <MoreHorizontal size={20} strokeWidth={2} />
      </button>
    </Reorder.Item>
  );
}

export function Plan({ tripId }: { tripId: string }) {
  const router = useRouter();
  const sb = useSupabase();
  const client = sb.status === "ready" ? sb.client : null;
  const userId = sb.status === "ready" ? sb.userId : null;

  const [view, setView] = useState<View | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [spots, setSpots] = useState<Map<string, Spot>>(new Map());
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlanItem | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [adding, setAdding] = useState<{ day: number; replace?: string } | null>(null);
  const [deciding, setDeciding] = useState(false);

  const itemsRef = useRef<PlanItem[]>([]);
  itemsRef.current = items;
  const versionRef = useRef(0);
  const inFlight = useRef(0);
  const dragging = useRef(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 読み込んだ工程案を画面に反映する。ほかの人が直していたら、お知らせを出す */
  const applyView = useCallback(
    (v: View) => {
      setView(v);
      setItems(v.items.map(toItem).sort(byOrder));
      versionRef.current = v.plan?.version ?? 0;
      if (client && v.me && v.plan && v.plan.version > v.me.last_seen_plan_version) {
        setNotice(v.plan.updated_reason);
        void client.from("members").update({ last_seen_plan_version: v.plan.version }).eq("id", v.me.member_id);
      }
    },
    [client],
  );

  const fetchView = useCallback(async (): Promise<View | null> => {
    if (!client) return null;
    const { data, error } = await client.rpc("plan_view", { p_trip_id: tripId });
    if (error || !data) return null;
    return data as View;
  }, [client, tripId]);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    (async () => {
      const [v, all] = await Promise.all([fetchView(), fetchAllSpots(client)]);
      if (!alive) return;
      if (!v || !v.me) return router.replace("/trips");
      setSpots(new Map(all.map((s) => [s.id, s])));
      applyView(v);
    })();
    return () => {
      alive = false;
    };
  }, [client, fetchView, applyView, router]);

  /** ほかの人の更新を読み直して反映する。自分が直している最中（保存中・ドラッグ中）は、上書きしない */
  const refresh = useCallback(async () => {
    if (!client || inFlight.current > 0 || dragging.current || touchTimer.current) return;
    const v = await fetchView();
    if (!v || inFlight.current > 0 || dragging.current) return;
    if ((v.plan?.version ?? 0) !== versionRef.current) applyView(v);
    else setView(v);
  }, [client, fetchView, applyView]);

  // 工程案・予定・参加状況の変更を、Supabase Realtime で受け取る（2人目が度合いを終えると、開いている画面に「2人目の回答で更新しました」が出る）
  useTripRealtime(client, tripId, ["plans", "plan_items", "members"], () => void refresh());
  useEffect(() => {
    if (!client) return;
    const t = window.setInterval(() => void refresh(), SAFETY_POLL_MS);
    return () => window.clearInterval(t);
  }, [client, refresh]);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (touchTimer.current) clearTimeout(touchTimer.current);
    },
    [],
  );

  const menu = items.find((i) => i.id === menuId) ?? null;
  const moving = items.find((i) => i.id === moveId) ?? null;
  const confirming = items.find((i) => i.id === confirmId) ?? null;

  if (sb.status === "unconfigured" || sb.status === "failed") return <SetupNotice status={sb.status} />;
  if (!client || !view) return <Loading />;

  const trip = view.trip;
  const SOLO = trip.companion === "solo";
  const ratingsDone = view.me?.rated_at != null;
  const dayCount = Math.max(daysFor(trip.nights), ...items.map((i) => i.day));
  const dayNumbers = Array.from({ length: dayCount }, (_, i) => i + 1);
  const dayItems = (d: number, from: PlanItem[] = items) => from.filter((i) => i.day === d).sort(byOrder);
  const planTitle = view.plan?.title ?? "旅の工程案";
  const inPlan = new Set(items.map((i) => i.spotId));
  const addable = view.candidate_spots.filter((c) => !inPlan.has(c.spot_id) && spots.has(c.spot_id));

  // ---- 保存（直したら、DBに書き、全員に「工程案が変わりました」を出す）----
  const row = (i: PlanItem) => ({
    id: i.id, trip_id: tripId, day: i.day, position: i.position, spot_id: i.spotId, title: i.title, time_hint: i.timeHint,
    pinned: i.pinned, edited_by_user: i.edited, source: i.source,
  });
  const scheduleTouch = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(async () => {
      touchTimer.current = null;
      const { data } = await client.rpc("touch_plan", { p_trip_id: tripId });
      if (typeof data === "number") versionRef.current = data;
    }, TOUCH_DELAY_MS);
  };
  const run = async (op: () => PromiseLike<unknown>) => {
    inFlight.current++;
    try {
      await op();
    } catch (e) {
      console.error("plan", e);
    } finally {
      inFlight.current--;
    }
    scheduleTouch();
  };
  const save = (list: PlanItem[]) => run(() => client.from("plan_items").upsert(list.map(row), { onConflict: "id" }));
  const markRemoved = (spotId: string) => client.from("removed_spots").upsert({ trip_id: tripId, spot_id: spotId, removed_by: userId }, { onConflict: "trip_id,spot_id", ignoreDuplicates: true });
  const unmarkRemoved = (spotId: string) => client.from("removed_spots").delete().eq("trip_id", tripId).eq("spot_id", spotId);
  /** サイトにない場所（spot_id なし）は、入力した文字で「外した場所」を記録する（作り直しで戻さない） */
  const markItemRemoved = (it: PlanItem) =>
    it.spotId
      ? markRemoved(it.spotId)
      : client.from("removed_free_places").upsert({ trip_id: tripId, place_text: it.title.slice(0, 30), removed_by: userId }, { onConflict: "trip_id,place_text", ignoreDuplicates: true });
  const unmarkItemRemoved = (it: PlanItem) =>
    it.spotId ? unmarkRemoved(it.spotId) : client.from("removed_free_places").delete().eq("trip_id", tripId).eq("place_text", it.title.slice(0, 30));

  /** その日の順番を差し替え、時刻の目安を早い順に振り直す（編集済みの印を付ける） */
  const reorderDay = (d: number, list: PlanItem[]): PlanItem[] => {
    const times = dayItems(d, itemsRef.current).map((i) => i.timeHint).filter((t): t is string => Boolean(t)).sort();
    const next = list.map((i, n) => ({ ...i, position: n + 1, timeHint: times[n] ?? i.timeHint, edited: true }));
    setItems([...itemsRef.current.filter((i) => i.day !== d), ...next].sort(byOrder));
    return next;
  };
  /** ドラッグを離したとき：その日の順番を保存する */
  const commitDay = (d: number) => {
    dragging.current = false;
    void save(dayItems(d, itemsRef.current));
  };

  const togglePin = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const next = { ...it, pinned: !it.pinned };
    setItems(items.map((i) => (i.id === id ? next : i)));
    void save([next]);
  };

  const shift = (id: string, dir: -1 | 1) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const list = dayItems(it.day);
    const n = list.findIndex((i) => i.id === id);
    const to = n + dir;
    if (to < 0 || to >= list.length) return;
    [list[n], list[to]] = [list[to], list[n]];
    void save(reorderDay(it.day, list));
  };

  const moveToDay = (id: string, day: number) => {
    const it = items.find((i) => i.id === id);
    if (!it || it.day === day) return;
    const target = dayItems(day);
    const moved: PlanItem = { ...it, day, position: (target[target.length - 1]?.position ?? 0) + 1, timeHint: timeAfterLast(target), edited: true };
    setItems(items.map((i) => (i.id === id ? moved : i)).sort(byOrder));
    void save([moved]);
  };

  const remove = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setRemoved({ item: it });
    setItems(items.filter((i) => i.id !== id));
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_MS);
    // 外した場所は、その旅の「外した場所」として記録する（作り直しで勝手に戻さない）
    void run(async () => {
      await client.from("plan_items").delete().eq("id", id);
      await markItemRemoved(it);
    });
  };

  const undo = () => {
    if (!removed) return;
    const it = removed.item;
    setItems([...items, it].sort(byOrder));
    setRemoved(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    void run(async () => {
      await client.from("plan_items").upsert(row(it), { onConflict: "id" });
      await unmarkItemRemoved(it);
    });
  };

  const askRemove = (it: PlanItem) => {
    setMenuId(null);
    if (it.pinned) setConfirmId(it.id);
    else remove(it.id);
  };

  const addSpot = (spotId: string) => {
    if (!adding) return;
    const s = spots.get(spotId);
    if (!s) return;
    const cand = view.candidate_spots.find((c) => c.spot_id === spotId);
    if (adding.replace) {
      const old = items.find((i) => i.id === adding.replace);
      if (!old) return setAdding(null);
      const next: PlanItem = { ...old, spotId, title: s.name, edited: true, pinned: false, levels: [], avg: cand?.avg ?? null };
      setItems(items.map((i) => (i.id === old.id ? next : i)));
      void run(async () => {
        await client.from("plan_items").upsert(row(next), { onConflict: "id" });
        await markItemRemoved(old);
        await unmarkRemoved(spotId);
      });
    } else {
      const list = dayItems(adding.day);
      const created: PlanItem = {
        id: crypto.randomUUID(), day: adding.day, position: (list[list.length - 1]?.position ?? 0) + 1, spotId, title: s.name,
        timeHint: timeAfterLast(list), pinned: false, edited: true, source: "user", levels: [], avg: cand?.avg ?? null,
      };
      setItems([...items, created].sort(byOrder));
      void run(async () => {
        await client.from("plan_items").upsert(row(created), { onConflict: "id" });
        await unmarkRemoved(spotId);
      });
    }
    setAdding(null);
  };

  const inviteUrl = () => `${window.location.origin}/j/${trip.code}`;
  const share = () => sendToFriend({ title: planTitle, text: "旅の工程案ができました", url: inviteUrl() });

  const decide = async () => {
    if (deciding) return;
    setDeciding(true);
    await client.rpc("decide_trip", { p_trip_id: tripId });
    router.push("/trips");
  };

  return (
    <>
      <Header
        left={{ type: "back", href: "/trips" }}
        title="旅の工程案"
        right={
          <button type="button" className="icon-btn" aria-label="共有" onClick={share}>
            <Share2 size={20} strokeWidth={2} />
          </button>
        }
      />
      <main className="screen has-tabbar content">
        {!ratingsDone && (
          <div className="notice" style={{ marginTop: 16, justifyContent: "space-between" }}>
            <span>あなたの行きたい度合いがまだです</span>
            <Link href={`/trips/${tripId}/rate`} className="small-btn">選ぶ</Link>
          </div>
        )}

        <div className="row-between" style={{ paddingTop: 18, alignItems: "flex-start" }}>
          <h1 style={{ fontSize: 22, maxWidth: 230 }}>{planTitle}</h1>
          {!SOLO && <span className="status-chip">{view.member_total}人中{view.rated_count}人が回答</span>}
        </div>
        <p className="lead" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {view.plan?.source === "ai" ? (
            <>
              <AiBadge />
              AIが、みんなの行きたい度合いから作りました。自由に直せます。
            </>
          ) : (
            // TODO(spec): ルール版の工程案の説明文は文言一覧にない（AIが作ったときの文から「AIが、」を除いた仮の文言。AiBadge は付けない）。
            "みんなの行きたい度合いから作りました。自由に直せます。"
          )}
        </p>

        {notice && (
          <div className="notice" style={{ marginTop: 14 }} role="status">
            <Users size={17} strokeWidth={2} aria-hidden="true" />
            {notice}
          </div>
        )}

        {dayNumbers.map((d) => (
          <section key={d} aria-label={`${d}日目`}>
            <div className="day-title">
              <span>{d}日目</span>
              <i />
            </div>
            <Reorder.Group as="div" axis="y" values={dayItems(d)} onReorder={(list) => reorderDay(d, list)} className="plan-list">
              {dayItems(d).map((item) => (
                <PlanCard
                  key={item.id}
                  item={item}
                  solo={SOLO}
                  spot={item.spotId ? spots.get(item.spotId) ?? null : null}
                  onOpen={() => setDetail(item)}
                  onMenu={() => setMenuId(item.id)}
                  onDragStart={() => (dragging.current = true)}
                  onDragEnd={() => commitDay(d)}
                />
              ))}
            </Reorder.Group>
            <button type="button" className="add-card" onClick={() => setAdding({ day: d })}>
              <Plus size={18} strokeWidth={2} aria-hidden="true" />
              候補から足す
            </button>
          </section>
        ))}

        {/* TODO(spec): M3 は下がタブバーのため、「LINEで送る」「この案で決める」は本文の末尾に置いた（下に固定するとタブバーと重なる）。 */}
        <div className="stack" style={{ marginTop: 28 }}>
          <PrimaryButton disabled={deciding} onClick={decide}>この案で決める</PrimaryButton>
          <SecondaryButton onClick={share}>{SOLO ? "友だちに見せる" : "LINEで送る"}</SecondaryButton>
        </div>
      </main>

      {/* 予定の詳細 */}
      <BottomSheet open={detail !== null} onClose={() => setDetail(null)} title={detail?.title ?? ""}>
        {detail &&
          (() => {
            const s = detail.spotId ? spots.get(detail.spotId) : undefined;
            if (!detail.spotId) {
              // サイトにない場所：タイトル、「地図で見る」（入力した文字で検索）、「この場所の情報は、このサイトにはありません。」だけ
              return (
                <div className="stack" style={{ paddingBottom: 12 }}>
                  <a className="secondary-btn" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detail.title)}`} target="_blank" rel="noopener noreferrer">
                    地図で見る
                  </a>
                  <p className="sub">この場所の情報は、このサイトにはありません。</p>
                </div>
              );
            }
            if (!s) return null;
            return (
              <div className="stack" style={{ paddingBottom: 12 }}>
                <SpotImage src={s.photo} name={s.name} area={s.area} category={s.category} aspect="16/10" displayWidth={350} />
                <PhotoCredit credit={s.credit} creditUrl={s.creditUrl} />
                <div>
                  <span className="sub">{s.prefecture}・{s.area}</span>
                  <p style={{ marginTop: 4 }}>{s.description}</p>
                </div>
                {s.isPartner && <div><PartnerBadge /></div>}
                <dl className="info-table card" style={{ padding: 16 }}>
                  <dt>時間の目安</dt><dd>{detail.timeHint ? `${hhmm(detail.timeHint)}ごろ` : "—"}</dd>
                  <dt>料金の目安</dt><dd>約{s.priceYen.toLocaleString()}円 / ひとり</dd>
                  <dt>所要時間</dt><dd>約{s.durationMin >= 60 ? `${Math.floor(s.durationMin / 60)}時間${s.durationMin % 60 ? `${s.durationMin % 60}分` : ""}` : `${s.durationMin}分`}</dd>
                  <dt>住所</dt><dd>{s.address}</dd>
                  <dt>営業時間</dt><dd>{s.hours}</dd>
                </dl>
                {!SOLO && detail.levels.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 14, marginBottom: 8 }}>みんなの行きたい度合い</h3>
                    <ul style={{ display: "flex", gap: 10, flexWrap: "wrap", listStyle: "none" }}>
                      {detail.levels.map((l, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "center", gap: 6 }} className="sub">
                          <LevelDot level={l} size={16} />
                          {RATING_NAMES[l]}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.lat !== null && s.lng !== null && (
                  <a className="secondary-btn" href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`} target="_blank" rel="noopener noreferrer">
                    地図で見る
                  </a>
                )}
                <SecondaryButton href={`/spots/${s.id}`}>場所の詳細</SecondaryButton>
                {s.isPartner && (
                  <button type="button" className="primary-btn" disabled>
                    予約する（デモのため押せません）
                  </button>
                )}
              </div>
            );
          })()}
      </BottomSheet>

      {/* 「…」のメニュー */}
      <BottomSheet open={menu !== null} onClose={() => setMenuId(null)} title="予定のメニュー">
        {menu && (() => {
          const list = dayItems(menu.day);
          const n = list.findIndex((i) => i.id === menu.id);
          return (
            <div className="sheet-list" style={{ paddingBottom: 12 }}>
              <button type="button" className="sheet-item" onClick={() => { togglePin(menu.id); setMenuId(null); }}>
                <Pin size={20} strokeWidth={2} aria-hidden="true" />
                {menu.pinned ? "絶対行くを外す" : "絶対行くにする"}
              </button>
              <button type="button" className="sheet-item" onClick={() => { setAdding({ day: menu.day, replace: menu.id }); setMenuId(null); }}>
                ほかの候補と入れ替える
              </button>
              <button type="button" className="sheet-item" disabled={n <= 0} onClick={() => { shift(menu.id, -1); setMenuId(null); }}>
                <ArrowUp size={20} strokeWidth={2} aria-hidden="true" />
                ひとつ上へ
              </button>
              <button type="button" className="sheet-item" disabled={n < 0 || n >= list.length - 1} onClick={() => { shift(menu.id, 1); setMenuId(null); }}>
                <ArrowDown size={20} strokeWidth={2} aria-hidden="true" />
                ひとつ下へ
              </button>
              <button type="button" className="sheet-item" disabled={dayNumbers.length < 2} onClick={() => { setMoveId(menu.id); setMenuId(null); }}>
                <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
                別の日に移す
              </button>
              <button type="button" className="sheet-item" onClick={() => askRemove(menu)}>
                <Trash2 size={20} strokeWidth={2} aria-hidden="true" />
                この予定を外す
              </button>
            </div>
          );
        })()}
      </BottomSheet>

      {/* 別の日に移す：移した先の最後に入る */}
      <BottomSheet open={moving !== null} onClose={() => setMoveId(null)} title="別の日に移す">
        {moving && (
          <div className="sheet-list" style={{ paddingBottom: 12 }}>
            {dayNumbers.filter((d) => d !== moving.day).map((d) => (
              <button key={d} type="button" className="sheet-item" onClick={() => { moveToDay(moving.id, d); setMoveId(null); }}>
                {d}日目の最後に移す
              </button>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* 絶対行くの予定を外すときだけ確認する */}
      <BottomSheet open={confirming !== null} onClose={() => setConfirmId(null)} title="絶対行くの予定です。外しますか？">
        {confirming && (
          <div className="stack" style={{ paddingBottom: 12 }}>
            <PrimaryButton onClick={() => { remove(confirming.id); setConfirmId(null); }}>外す</PrimaryButton>
            <SecondaryButton onClick={() => setConfirmId(null)}>やめる</SecondaryButton>
          </div>
        )}
      </BottomSheet>

      {removed && (
        <div className="toast" role="status">
          <span>予定を外しました</span>
          <button type="button" onClick={undo}>元に戻す</button>
        </div>
      )}

      {/* 候補から足す／入れ替える：この旅のおすすめの場所のうち工程案にないものを、みんなの平均が高い順に */}
      <BottomSheet open={adding !== null} onClose={() => setAdding(null)} title={adding?.replace ? "ほかの候補と入れ替える" : "候補から足す"}>
        <div className="stack" style={{ paddingBottom: 12 }}>
          {addable.length === 0 && <p className="sub">足せる候補はありません。</p>}
          {addable.map((c) => {
            const s = spots.get(c.spot_id)!;
            return (
              <button key={s.id} type="button" className="card check-row" style={{ minHeight: 72 }} onClick={() => addSpot(s.id)}>
                <span>
                  <b>{s.name}</b>
                  <br />
                  <span className="sub min">{s.prefecture}・{s.area}</span>
                </span>
              </button>
            );
          })}
          <TextLink onClick={() => setAdding(null)}>閉じる</TextLink>
        </div>
      </BottomSheet>
    </>
  );
}
