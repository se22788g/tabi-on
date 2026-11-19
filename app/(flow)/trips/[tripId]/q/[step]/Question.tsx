"use client";

import { MapPin, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header, ProgressBar } from "@/components/layout/Header";
import { PrivacyNote } from "@/components/ui/badges";
import { BottomBar, PrimaryButton } from "@/components/ui/buttons";
import { CheckRow, ScaleButtons } from "@/components/ui/choices";
import { questionHint, visibleQuestions } from "@/lib/domain/questions";
import { isFreeText, MAX_FREE_TEXT_LEN, MAX_FREE_TEXTS, normalizePlaceText } from "@/lib/domain/places";
import { prefectureShort } from "@/lib/domain/spot";
import { tripSummary } from "@/lib/domain/trip-label";
import { useQuestions } from "../QuestionsProvider";

export function Question({ tripId, step }: { tripId: string; step: number }) {
  const router = useRouter();
  const { trip, memberCount, isOwner, spots, answers, set, finish } = useQuestions();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const questions = visibleQuestions(trip);
  const total = questions.length;
  const n = Number.isInteger(step) && step >= 1 && step <= total ? step : null;

  useEffect(() => {
    if (n === null) router.replace(`/trips/${tripId}/q/1`);
  }, [n, router, tripId]);
  if (n === null) return null;

  const question = questions[n - 1];
  const summary = tripSummary({ months: trip.months, nights: trip.nights, companion: trip.companion, memberCount });
  const value = answers[question.id] ?? null;
  const multi = Array.isArray(value) ? value : [];

  // 1問目の「戻る」：言い出し役は F2（ひとり旅は招待がないので F1）。参加者は M2。
  // TODO(spec): 仕様書は「参加者は F3」だが、F3 は参加済みの端末を続きの画面に移すため、F3 に戻ると 1 問目に戻って堂々巡りになる。
  // 参加者の1問目の「戻る」は、仮に M2（旅）にする。
  const backHref = n === 1 ? (isOwner ? (trip.companion === "solo" ? "/trips/new" : `/trips/${tripId}/invite`) : "/trips") : `/trips/${tripId}/q/${n - 1}`;
  // 「次へ」も「とばす」も同じ扱い。何も選んでいなければ回答なし（行を作らない）
  const go = async () => {
    if (busy) return;
    if (n === total) {
      setBusy(true);
      await finish();
      router.push(`/trips/${tripId}/intro`);
    } else {
      router.push(`/trips/${tripId}/q/${n + 1}`);
    }
  };

  const toggle = (opt: string) => set(question.id, multi.includes(opt) ? multi.filter((o) => o !== opt) : [...multi, opt]);

  return (
    <>
      <Header
        left={{ type: "back", href: backHref }}
        center={<ProgressBar value={n} max={total} />}
        right={
          <button type="button" className="header-text-btn" onClick={go}>
            とばす
          </button>
        }
      />
      <main className="screen has-action content">
        <div style={{ paddingTop: 12 }}>
          <span className="chip static">{summary}</span>
        </div>
        <p className="accent-text" style={{ marginTop: 20 }}>
          {n} / {total}
        </p>
        <h1 style={{ marginTop: 4 }}>{question.title}</h1>
        <p className="lead">{questionHint(question)}</p>

        {question.kind === "multi" && (
          <div className="answer-list">
            {question.options!.map((o) => (
              <CheckRow key={o} label={o} selected={multi.includes(o)} onClick={() => toggle(o)} />
            ))}
          </div>
        )}

        {question.kind === "scale" && (
          <div style={{ marginTop: 40 }}>
            <ScaleButtons
              value={typeof value === "number" ? value : null}
              onChange={(v) => set(question.id, v)}
              left={question.left!}
              right={question.right!}
            />
          </div>
        )}

        {question.kind === "places" && (() => {
          const freeCount = multi.filter(isFreeText).length;
          const text = search.trim();
          const dup = multi.some((e) => isFreeText(e) && normalizePlaceText(e.text) === normalizePlaceText(text));
          const canAddFree = text.length > 0 && normalizePlaceText(text).length > 0 && !dup && freeCount < MAX_FREE_TEXTS;
          const results = text ? spots.filter((s) => !multi.includes(s.id) && [s.name, s.area, s.prefecture].some((t) => t.includes(text))) : [];
          return (
            <div className="stack" style={{ marginTop: 24 }}>
              <label className="text-input" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Search size={18} strokeWidth={2} aria-hidden="true" />
                <input
                  style={{ flex: 1, minWidth: 0, minHeight: 44, background: "transparent", outline: 0 }}
                  value={search}
                  maxLength={MAX_FREE_TEXT_LEN}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="銀山温泉、蔵王など"
                  aria-label="場所を検索"
                />
              </label>
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="check-row"
                  aria-pressed={false}
                  onClick={() => {
                    set(question.id, [...multi, s.id]);
                    setSearch("");
                  }}
                >
                  <MapPin size={18} strokeWidth={2} aria-hidden="true" />
                  <span>
                    {s.name}
                    <span className="sub"> ・ {prefectureShort(s.prefecture)}・{s.area}</span>
                  </span>
                </button>
              ))}
              {/* 候補にない場所も、入力した文字のまま追加できる（30字まで、5件まで） */}
              {text && (
                <button
                  type="button"
                  className="check-row"
                  disabled={!canAddFree}
                  onClick={() => {
                    set(question.id, [...multi, { text }]);
                    setSearch("");
                  }}
                >
                  <Plus size={18} strokeWidth={2} aria-hidden="true" />
                  <span>『{text}』をそのまま追加</span>
                </button>
              )}
              {text && freeCount >= MAX_FREE_TEXTS && (
                // TODO(spec): 5件に達したときの文言は仕様書にない（仮の文言）。
                <p className="sub" role="status">そのまま追加できるのは、5件までです。</p>
              )}
              {multi.map((e) => {
                if (isFreeText(e)) {
                  return (
                    <div className="added-place" key={`t:${e.text}`}>
                      <MapPin size={18} strokeWidth={2} aria-hidden="true" />
                      <span>
                        {e.text}
                        <span className="sub min" style={{ display: "block" }}>サイトにない場所</span>
                      </span>
                      <button type="button" className="header-text-btn" aria-label={`${e.text}を削除`} onClick={() => set(question.id, multi.filter((x) => x !== e))}>
                        削除
                      </button>
                    </div>
                  );
                }
                const s = spots.find((x) => x.id === e);
                return (
                  <div className="added-place" key={e}>
                    <MapPin size={18} strokeWidth={2} aria-hidden="true" />
                    <span>
                      {s?.name ?? e}
                      {s && <span className="sub min" style={{ display: "block" }}>{prefectureShort(s.prefecture)}・{s.area}</span>}
                    </span>
                    <button type="button" className="header-text-btn" aria-label={`${s?.name ?? e}を削除`} onClick={() => set(question.id, multi.filter((x) => x !== e))}>
                      削除
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <PrivacyNote />
      </main>
      <BottomBar>
        <PrimaryButton disabled={busy} onClick={go}>次へ</PrimaryButton>
      </BottomBar>
    </>
  );
}
