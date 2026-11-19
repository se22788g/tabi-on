"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Header, Logo } from "@/components/layout/Header";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { BottomBar, PrimaryButton } from "@/components/ui/buttons";
import { Chip } from "@/components/ui/choices";
import { MOCK_TRIP_ID, PREFECTURES } from "@/lib/mock/data";
import { nearestOrigin } from "@/lib/domain/travel";
import type { Companion, Nights } from "@/lib/domain/questions";

const COMPANIONS: { value: Companion; label: string }[] = [
  { value: "solo", label: "ひとり" },
  { value: "friends", label: "友人" },
  { value: "partner", label: "恋人" },
  { value: "family_kids", label: "家族・小さい子あり" },
  { value: "family_adults", label: "家族・大人のみ" },
  { value: "undecided", label: "未定" },
];
const NIGHTS: { value: Nights; label: string }[] = [
  { value: "day", label: "日帰り" },
  { value: "1", label: "1泊" },
  { value: "2", label: "2泊" },
  { value: "3plus", label: "3泊以上" },
  { value: "undecided", label: "未定" },
];
const ORIGINS = ["東京", "大阪", "名古屋", "福岡", "仙台", "札幌", "その他", "未定"];
const REGIONS = ["北海道", "東北", "関東", "中部・北陸", "関西", "中国・四国", "九州・沖縄", "どこでも", "未定"];
const EXCLUSIVE_REGIONS = ["どこでも", "未定"];
const MAX_MEMBERS = 12;

/** 今月から6か月分の月（1〜12） */
function nextSixMonths(): number[] {
  const m = new Date().getMonth();
  return Array.from({ length: 6 }, (_, i) => ((m + i) % 12) + 1);
}

export function NewTrip({ seed }: { seed: { id: string; label: string } | null }) {
  const [seedOn, setSeedOn] = useState(Boolean(seed));
  const [companion, setCompanion] = useState<Companion>("undecided");
  const [ownerName, setOwnerName] = useState("");
  const [name, setName] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [months, setMonths] = useState<number[]>([]);
  const [monthsUndecided, setMonthsUndecided] = useState(false);
  const [nights, setNights] = useState<Nights>("undecided");
  const [origin, setOrigin] = useState("未定");
  const [prefecture, setPrefecture] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [regions, setRegions] = useState<string[]>(seed ? [] : []);
  const [nameError, setNameError] = useState("");
  const monthOptions = nextSixMonths();
  const solo = companion === "solo";

  const addName = () => {
    const raw = name.trim();
    if (raw.length < 1 || raw.length > 10) {
      setNameError("名前は1〜10文字で入れてください");
      return;
    }
    // 言い出し役を含めて最大12人
    if (names.length + 1 >= MAX_MEMBERS) {
      setNameError("一緒に行く人は、あなたを入れて12人までです");
      return;
    }
    const taken = new Set([ownerName.trim() || "わたし", ...names]);
    let unique = raw;
    for (let n = 2; taken.has(unique); n++) unique = `${raw}（${n}）`;
    setNames([...names, unique]);
    setName("");
    setNameError("");
  };

  const toggleMonth = (m: number) => {
    setMonthsUndecided(false);
    const next = months.includes(m) ? months.filter((x) => x !== m) : [...months, m];
    // 今月から数えた並びで持つ（問5の季節は「一番早い月」で決めるため）
    setMonths(next.sort((a, b) => monthOptions.indexOf(a) - monthOptions.indexOf(b)));
  };
  const toggleRegion = (r: string) => {
    if (EXCLUSIVE_REGIONS.includes(r)) return setRegions(regions.includes(r) ? [] : [r]);
    const rest = regions.filter((x) => !EXCLUSIVE_REGIONS.includes(x));
    setRegions(rest.includes(r) ? rest.filter((x) => x !== r) : [...rest, r]);
  };

  const next = solo ? `/trips/${MOCK_TRIP_ID}/q/1` : `/trips/${MOCK_TRIP_ID}/invite`;

  return (
    <>
      <Header left={{ type: "close", href: "/trips" }} center={<Logo />} />
      <main className="screen has-action content">
        <div style={{ paddingTop: 20 }}>
          <h1>旅をはじめよう</h1>
          <p className="lead">決まっていることだけでOK。行き先は、みんなの気持ちから決めます。</p>
        </div>

        {seed && seedOn && (
          <div className="card seed-card">
            <span>この場所から考えます：{seed.label}</span>
            <button type="button" className="icon-btn" aria-label="この場所を外す" onClick={() => setSeedOn(false)}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        )}

        <div className="card form-card">
          <section className="field-group">
            <h3>だれと行く？</h3>
            <div className="chips">
              {COMPANIONS.map((c) => (
                <Chip key={c.value} selected={companion === c.value} undecided={c.value === "undecided"} onClick={() => setCompanion(c.value)}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </section>

          {!solo && (
            <section className="field-group">
              <h3>一緒に行く人</h3>
              <div className="stack">
                <input
                  className="text-input"
                  value={ownerName}
                  maxLength={10}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="あなたの名前"
                  aria-label="あなたの名前"
                />
                <div className="input-row">
                  <input
                    className="text-input"
                    value={name}
                    maxLength={10}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addName())}
                    placeholder="名前を入力"
                    aria-label="一緒に行く人の名前"
                  />
                  <button type="button" className="small-btn" onClick={addName}>
                    <Plus size={16} strokeWidth={2} aria-hidden="true" />
                    追加
                  </button>
                </div>
              </div>
              {nameError && (
                <p className="sub" role="alert" style={{ marginTop: 8, color: "#b3261e" }}>
                  {nameError}
                </p>
              )}
              {names.length > 0 && (
                <div className="companion-list">
                  {names.map((n) => (
                    <span key={n} className="chip" style={{ paddingRight: 4 }}>
                      {n}
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 36, height: 36, background: "transparent", border: 0 }}
                        aria-label={`${n}を外す`}
                        onClick={() => setNames(names.filter((x) => x !== n))}
                      >
                        <X size={16} strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="field-group">
            <h3>時期</h3>
            <div className="chips">
              {monthOptions.map((m) => (
                <Chip key={m} selected={months.includes(m)} onClick={() => toggleMonth(m)}>
                  {m}月
                </Chip>
              ))}
              <Chip
                undecided
                selected={monthsUndecided}
                onClick={() => {
                  setMonthsUndecided(!monthsUndecided);
                  setMonths([]);
                }}
              >
                未定
              </Chip>
            </div>
          </section>

          <section className="field-group">
            <h3>何泊？</h3>
            <div className="chips">
              {NIGHTS.map((n) => (
                <Chip key={n.value} selected={nights === n.value} undecided={n.value === "undecided"} onClick={() => setNights(n.value)}>
                  {n.label}
                </Chip>
              ))}
            </div>
          </section>

          <section className="field-group">
            <h3>出発地</h3>
            <div className="chips">
              {ORIGINS.map((o) => (
                <Chip
                  key={o}
                  selected={origin === o}
                  undecided={o === "未定"}
                  onClick={() => {
                    setOrigin(o);
                    if (o === "その他") setSheet(true);
                  }}
                >
                  {o}
                </Chip>
              ))}
            </div>
            {origin === "その他" && prefecture && (
              <p className="sub" style={{ marginTop: 8 }}>
                {prefecture}（{nearestOrigin(prefecture)}を目安に計算します）
              </p>
            )}
          </section>

          <section className="field-group">
            <h3>行き先の地域</h3>
            <div className="chips">
              {REGIONS.map((r) => (
                <Chip key={r} selected={regions.includes(r)} undecided={EXCLUSIVE_REGIONS.includes(r)} onClick={() => toggleRegion(r)}>
                  {r}
                </Chip>
              ))}
            </div>
            {/* TODO(spec): 「この場所から考えます」のとき、地域をその場所に合わせる処理は段階3（旅を作るとき）で入れる。 */}
          </section>
        </div>
      </main>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="出発地の都道府県">
        <div className="chips" style={{ paddingBottom: 12 }}>
          {PREFECTURES.map((p) => (
            <Chip
              key={p}
              selected={prefecture === p}
              onClick={() => {
                setPrefecture(p);
                setSheet(false);
              }}
            >
              {p}
            </Chip>
          ))}
        </div>
      </BottomSheet>

      <BottomBar>
        <PrimaryButton href={next}>{solo ? "次へ：質問に答える" : "次へ：招待コードを発行する"}</PrimaryButton>
      </BottomBar>
    </>
  );
}
