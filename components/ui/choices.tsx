import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { RATING_NAMES, type RatingLevel } from "@/lib/mock/data";

/** 1つだけ選ぶ問い、または複数選ぶ時期など。「未定」は点線の縁 */
export function Chip({
  children,
  selected,
  onClick,
  undecided,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  undecided?: boolean;
}) {
  return (
    <button type="button" className={`chip ${undecided ? "undecided" : ""}`} aria-pressed={selected} onClick={onClick}>
      {selected && <Check size={15} strokeWidth={2} aria-hidden="true" />}
      {children}
    </button>
  );
}

/** 複数選ぶ問い。行全体を押せる */
export function CheckRow({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className="check-row" aria-pressed={selected} onClick={onClick}>
      <span className="check-box" aria-hidden="true">
        <Check size={16} strokeWidth={3} />
      </span>
      <span>{label}</span>
    </button>
  );
}

/** 5段階の問い */
export function ScaleButtons({
  value,
  onChange,
  left,
  right,
}: {
  value: number | null;
  onChange: (v: number) => void;
  left: string;
  right: string;
}) {
  return (
    <div className="scale-wrap">
      <div className="scale-labels">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="scale" role="group" aria-label="5段階">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <p className="scale-note">3 = どちらでもない</p>
    </div>
  );
}

/** 行きたい度合い（0〜4）。色は行きたい度合いにだけ使う */
export function RatingDots({
  value,
  onChange,
  disabled,
}: {
  value: RatingLevel | null;
  onChange: (v: RatingLevel) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rating-dots" role="group" aria-label="行きたい度合い">
      {RATING_NAMES.map((name, i) => (
        <button
          key={name}
          type="button"
          className={`rate-${i}`}
          aria-pressed={value === i}
          disabled={disabled}
          onClick={() => onChange(i as RatingLevel)}
        >
          <span className="rating-dot bg-rate">{value === i && <Check size={20} strokeWidth={3} aria-hidden="true" />}</span>
          {name}
        </button>
      ))}
    </div>
  );
}

/** 行きたい度合いの小さな丸（表示用） */
export function LevelDot({ level, size = 12 }: { level: number; size?: number }) {
  const l = Math.min(4, Math.max(0, Math.round(level)));
  return <span className={`dot bg-rate rate-${l}`} style={{ width: size, height: size }} aria-hidden="true" />;
}
