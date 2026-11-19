"use client";

import { MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Header, ProgressBar } from "@/components/layout/Header";
import { PrivacyNote } from "@/components/ui/badges";
import { BottomBar, PrimaryButton } from "@/components/ui/buttons";
import { CheckRow, ScaleButtons } from "@/components/ui/choices";
import { SPOTS } from "@/lib/mock/data";
import { questionHint, type Question as Q } from "@/lib/domain/questions";
import { useAnswers } from "../AnswersProvider";

export function Question({
  tripId,
  n,
  total,
  question,
  summary,
  query,
}: {
  tripId: string;
  n: number;
  total: number;
  question: Q;
  summary: string;
  query: string;
}) {
  const router = useRouter();
  const { answers, set } = useAnswers();
  const [search, setSearch] = useState("");
  const value = answers[question.id] ?? null;
  const multi = Array.isArray(value) ? value : [];

  const nextHref = n === total ? `/trips/${tripId}/intro` : `/trips/${tripId}/q/${n + 1}${query}`;
  const backHref = n === 1 ? `/trips/${tripId}/invite` : `/trips/${tripId}/q/${n - 1}${query}`;
  const go = () => router.push(nextHref);

  const toggle = (opt: string) => set(question.id, multi.includes(opt) ? multi.filter((o) => o !== opt) : [...multi, opt]);

  const results = search.trim()
    ? SPOTS.filter((s) => !multi.includes(s.id) && [s.name, s.area, s.prefecture].some((t) => t.includes(search.trim())))
    : [];

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

        {question.kind === "places" && (
          <div className="stack" style={{ marginTop: 24 }}>
            <label className="text-input" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Search size={18} strokeWidth={2} aria-hidden="true" />
              <input
                style={{ flex: 1, minWidth: 0, minHeight: 44, background: "transparent", outline: 0 }}
                value={search}
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
                  <span className="sub"> ・ {s.prefecture}{s.area}</span>
                </span>
              </button>
            ))}
            {multi.map((id) => {
              const s = SPOTS.find((x) => x.id === id);
              return (
                <div className="added-place" key={id}>
                  <MapPin size={18} strokeWidth={2} aria-hidden="true" />
                  <span>{s?.name ?? id}</span>
                  <button type="button" className="header-text-btn" onClick={() => set(question.id, multi.filter((x) => x !== id))}>
                    削除
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <PrivacyNote />
      </main>
      <BottomBar>
        <PrimaryButton onClick={go}>次へ</PrimaryButton>
      </BottomBar>
    </>
  );
}
