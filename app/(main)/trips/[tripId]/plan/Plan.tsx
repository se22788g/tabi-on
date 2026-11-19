"use client";

import { ArrowDown, ArrowRight, ArrowUp, GripVertical, MoreHorizontal, Pin, Plus, Share2, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { AiBadge, PartnerBadge } from "@/components/ui/badges";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton, SecondaryButton, TextLink } from "@/components/ui/buttons";
import { LevelDot } from "@/components/ui/choices";
import { Photo } from "@/components/ui/Photo";
import { PLAN_ITEMS, PLAN_TITLE, RATING_NAMES, SPOTS, spotById, type MockPlanItem } from "@/lib/mock/data";
import { sendToFriend } from "@/lib/share";

// TODO(spec): ひとりの旅の判定・自分の評価の有無・更新のお知らせの条件は段階3で旅のデータから決める。
const SOLO = false;
const MY_RATINGS_DONE = true;
const SHOW_UPDATE_NOTICE = true;

const avg = (levels: number[]) => levels.reduce((a, b) => a + b, 0) / levels.length;
const hhmm = (t: string) => t.replace(/^0/, "");
const DAY_NUMBERS = Array.from(new Set(PLAN_ITEMS.map((i) => i.day))).sort();
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** TODO(spec): 本来は移動時間の表から振る（段階3）。段階1は、その日の最後の時刻の2時間後（21:00まで）にする */
const timeAfterLast = (list: MockPlanItem[]) => fromMin(Math.min(21 * 60, (list.length ? Math.max(...list.map((i) => toMin(i.timeHint))) : 8 * 60) + 120));
const UNDO_MS = 5000;

type Removed = { item: MockPlanItem; index: number };

/** つかんで上下に動かせる予定カード。つまみは左端、「…」は右上 */
function PlanCard({
  item,
  solo,
  spotName,
  onOpen,
  onMenu,
}: {
  item: MockPlanItem;
  solo: boolean;
  spotName: string;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const controls = useDragControls();
  const sorted = [...item.levels].sort((a, b) => b - a);
  return (
    <Reorder.Item
      as="div"
      value={item}
      dragListener={false}
      dragControls={controls}
      className={`plan-item ${item.pinned ? "pinned" : ""}`}
      whileDrag={{ scale: 1.02, boxShadow: "0 10px 28px rgba(60, 40, 90, 0.22)", zIndex: 5 }}
    >
      <button
        type="button"
        className="grip"
        aria-label="並べ替えのつまみ。上下にドラッグします"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical size={20} strokeWidth={2} aria-hidden="true" />
      </button>
      <button type="button" className="main" onClick={onOpen}>
        <span className="heat" aria-hidden="true">
          <LevelDot level={avg(item.levels)} size={9} />
        </span>
        {item.pinned && (
          <span className="pin-label">
            <Pin size={13} strokeWidth={2} aria-hidden="true" />
            絶対行く
          </span>
        )}
        <b>{item.title}</b>
        <span className="sub min">{hhmm(item.timeHint)}ごろ・{spotName}</span>
        {!solo && (
          <span className="responses" aria-label="みんなの行きたい度合い">
            <span>みんな</span>
            {sorted.map((l, i) => (
              <i key={i} className={`bg-rate rate-${l}`} />
            ))}
          </span>
        )}
      </button>
      <button type="button" className="icon-btn more" style={{ background: "transparent", border: 0 }} aria-label="予定のメニュー" onClick={onMenu}>
        <MoreHorizontal size={20} strokeWidth={2} />
      </button>
    </Reorder.Item>
  );
}

export function Plan({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<MockPlanItem[]>(PLAN_ITEMS);
  const [detail, setDetail] = useState<MockPlanItem | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [adding, setAdding] = useState<{ day: number; replace?: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const menu = items.find((i) => i.id === menuId) ?? null;
  const moving = items.find((i) => i.id === moveId) ?? null;
  const confirming = items.find((i) => i.id === confirmId) ?? null;
  const addable = SPOTS.filter((s) => !items.some((i) => i.spotId === s.id));
  const dayItems = (d: number, from: MockPlanItem[] = items) => from.filter((i) => i.day === d);

  /** その日の順番を差し替え、時刻の目安を早い順に振り直す（印は編集済みにする） */
  const setDayOrder = (d: number, list: MockPlanItem[]) => {
    const times = dayItems(d).map((i) => i.timeHint).sort();
    const next = list.map((i, n) => ({ ...i, timeHint: times[n] ?? i.timeHint, editedByUser: true }));
    setItems(DAY_NUMBERS.flatMap((x) => (x === d ? next : dayItems(x))));
  };

  const togglePin = (id: string) => setItems(items.map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i)));

  const shift = (id: string, dir: -1 | 1) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const list = [...dayItems(it.day)];
    const n = list.findIndex((i) => i.id === id);
    const to = n + dir;
    if (to < 0 || to >= list.length) return;
    [list[n], list[to]] = [list[to], list[n]];
    setDayOrder(it.day, list);
  };

  const moveToDay = (id: string, day: number) => {
    const it = items.find((i) => i.id === id);
    if (!it || it.day === day) return;
    const moved = { ...it, day, timeHint: timeAfterLast(dayItems(day)), editedByUser: true };
    setItems(DAY_NUMBERS.flatMap((x) => (x === day ? [...dayItems(x).filter((i) => i.id !== id), moved] : dayItems(x).filter((i) => i.id !== id))));
  };

  const remove = (id: string) => {
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) return;
    // TODO(spec): 外した場所を「その旅の外した場所」として記録し、作り直しで戻さない（記録先は段階3で決める）。
    setRemoved({ item: items[index], index });
    setItems(items.filter((i) => i.id !== id));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRemoved(null), UNDO_MS);
  };

  const undo = () => {
    if (!removed) return;
    const next = [...items];
    next.splice(Math.min(removed.index, next.length), 0, removed.item);
    setItems(next);
    setRemoved(null);
    if (timer.current) clearTimeout(timer.current);
  };

  const askRemove = (it: MockPlanItem) => {
    setMenuId(null);
    if (it.pinned) setConfirmId(it.id);
    else remove(it.id);
  };

  const addSpot = (spotId: string) => {
    if (!adding) return;
    const s = spotById(spotId)!;
    const base: MockPlanItem = { id: `u-${Date.now()}`, day: adding.day, spotId, title: s.name, timeHint: timeAfterLast(dayItems(adding.day)), levels: [3, 3, 2], pinned: false, editedByUser: true };
    if (adding.replace) {
      const old = items.find((i) => i.id === adding.replace)!;
      setItems(items.map((i) => (i.id === adding.replace ? { ...base, day: old.day, timeHint: old.timeHint } : i)));
    } else {
      setItems(DAY_NUMBERS.flatMap((x) => (x === adding.day ? [...dayItems(x), base] : dayItems(x))));
    }
    setAdding(null);
  };

  const share = () => sendToFriend({ title: PLAN_TITLE, text: "旅の工程案ができました", url: window.location.href });

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
        {!MY_RATINGS_DONE && (
          <div className="notice" style={{ marginTop: 16, justifyContent: "space-between" }}>
            <span>あなたの行きたい度合いがまだです</span>
            <Link href={`/trips/${tripId}/rate`} className="small-btn">選ぶ</Link>
          </div>
        )}

        <div className="row-between" style={{ paddingTop: 18, alignItems: "flex-start" }}>
          <h1 style={{ fontSize: 22, maxWidth: 230 }}>{PLAN_TITLE}</h1>
          {!SOLO && <span className="status-chip">4人中3人が回答</span>}
        </div>
        <p className="lead" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <AiBadge />
          AIが、みんなの行きたい度合いから作りました。自由に直せます。
        </p>

        {SHOW_UPDATE_NOTICE && (
          <div className="notice" style={{ marginTop: 14 }} role="status">
            <Users size={17} strokeWidth={2} aria-hidden="true" />
            3人目の回答で更新しました
          </div>
        )}

        {DAY_NUMBERS.map((d) => (
          <section key={d} aria-label={`${d}日目`}>
            <div className="day-title">
              <span>{d}日目</span>
              <i />
            </div>
            <Reorder.Group as="div" axis="y" values={dayItems(d)} onReorder={(list) => setDayOrder(d, list)} className="plan-list">
              {dayItems(d).map((item) => (
                <PlanCard
                  key={item.id}
                  item={item}
                  solo={SOLO}
                  spotName={spotById(item.spotId)!.name}
                  onOpen={() => setDetail(item)}
                  onMenu={() => setMenuId(item.id)}
                />
              ))}
            </Reorder.Group>
            <button type="button" className="add-card" onClick={() => setAdding({ day: d })}>
              <Plus size={18} strokeWidth={2} aria-hidden="true" />
              候補から足す
            </button>
          </section>
        ))}

        {/* TODO(spec): M3 は下がタブバーのため、「LINEで送る」「この案で決める」は本文の末尾に置いた（下に固定するとタブバーと重なる）。
            「決める」で trips.status を decided にし、決めたあとに直したら全員に「工程案が変わりました」を出す処理は段階3以降。 */}
        <div className="stack" style={{ marginTop: 28 }}>
          <PrimaryButton onClick={() => router.push("/trips")}>この案で決める</PrimaryButton>
          <SecondaryButton onClick={share}>{SOLO ? "友だちに見せる" : "LINEで送る"}</SecondaryButton>
        </div>
      </main>

      {/* 予定の詳細 */}
      <BottomSheet open={detail !== null} onClose={() => setDetail(null)} title={detail?.title ?? ""}>
        {detail &&
          (() => {
            const s = spotById(detail.spotId)!;
            return (
              <div className="stack" style={{ paddingBottom: 12 }}>
                <Photo src={s.photo} alt={s.alt} label={s.name} className="" />
                <div>
                  <span className="sub">{s.prefecture}・{s.area}</span>
                  <p style={{ marginTop: 4 }}>{s.description}</p>
                </div>
                {s.isPartner && <div><PartnerBadge /></div>}
                <dl className="info-table card" style={{ padding: 16 }}>
                  <dt>時間の目安</dt><dd>{hhmm(detail.timeHint)}ごろ</dd>
                  <dt>料金の目安</dt><dd>約{s.priceYen.toLocaleString()}円 / ひとり</dd>
                  <dt>所要時間</dt><dd>約{s.durationMin >= 60 ? `${Math.floor(s.durationMin / 60)}時間${s.durationMin % 60 ? `${s.durationMin % 60}分` : ""}` : `${s.durationMin}分`}</dd>
                  <dt>住所</dt><dd>{s.address}</dd>
                  <dt>営業時間</dt><dd>{s.hours}</dd>
                </dl>
                {!SOLO && (
                  <div>
                    <h3 style={{ fontSize: 14, marginBottom: 8 }}>みんなの行きたい度合い</h3>
                    <ul style={{ display: "flex", gap: 10, flexWrap: "wrap", listStyle: "none" }}>
                      {[...detail.levels].sort((a, b) => b - a).map((l, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "center", gap: 6 }} className="sub">
                          <LevelDot level={l} size={16} />
                          {RATING_NAMES[l]}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <a
                  className="secondary-btn"
                  href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  地図で見る
                </a>
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
              <button type="button" className="sheet-item" disabled={DAY_NUMBERS.length < 2} onClick={() => { setMoveId(menu.id); setMenuId(null); }}>
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
            {DAY_NUMBERS.filter((d) => d !== moving.day).map((d) => (
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

      {/* 候補から足す／入れ替える：工程案にない場所を、みんなの平均が高い順に */}
      <BottomSheet open={adding !== null} onClose={() => setAdding(null)} title={adding?.replace ? "ほかの候補と入れ替える" : "候補から足す"}>
        <div className="stack" style={{ paddingBottom: 12 }}>
          {/* TODO(spec): 段階1は仮の並び。段階3で「この旅のおすすめの場所のうち工程案にないもの」を平均の高い順に出す。 */}
          {addable.length === 0 && <p className="sub">足せる候補はありません。</p>}
          {addable.map((s) => (
            <button key={s.id} type="button" className="card check-row" style={{ minHeight: 72 }} onClick={() => addSpot(s.id)}>
              <span>
                <b>{s.name}</b>
                <br />
                <span className="sub min">{s.prefecture}・{s.area}</span>
              </span>
            </button>
          ))}
          <TextLink onClick={() => setAdding(null)}>閉じる</TextLink>
        </div>
      </BottomSheet>
    </>
  );
}
