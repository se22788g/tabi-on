import { BarChart3, Heart, Map } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { AiBadge, PrivacyNote } from "@/components/ui/badges";
import { PREFERENCE_BARS, WANTS_TREND } from "@/lib/mock/data";

const TONE = { hot: "tone-strong", warm: "tone-often", mid: "tone-normal", cool: "tone-light", cold: "tone-rare" } as const;
const COUNT = 12;

export default function Page() {
  return (
    <>
      <Header left={{ type: "back", href: "/me" }} title="あなたの旅の傾向" />
      <main className="screen has-tabbar content">
        <section className="card" style={{ marginTop: 16, padding: 19 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <span className="icon-tile"><BarChart3 size={24} strokeWidth={2} aria-hidden="true" /></span>
            <div style={{ display: "grid", gap: 6 }}>
              {/* TODO(spec): AIのひとこと。段階5でAI（または「{上位1}と{上位2}に、心が動くみたい。」のルール版）につなぐ。 */}
              <AiBadge />
              <h1 style={{ fontSize: 21 }}>温泉と雪景色に、<br />心が動くみたい。</h1>
              <p className="sub">これまでの{COUNT}件の行きたい度合いから</p>
            </div>
          </div>
          <div className="legend">
            <span><i className="bg-rate rate-0" />ひかえめ</span>
            <span><i className="bg-rate rate-4" />強い気持ち</span>
          </div>
        </section>

        <section className="card" style={{ marginTop: 13, padding: 19 }}>
          <div className="row-between">
            <h2 style={{ fontSize: 18 }}>よく選ぶ「したいこと」</h2>
            <Heart size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="trend-chips">
            {WANTS_TREND.map((w) => (
              <span key={w.label} className={TONE[w.tone]}>{w.label}</span>
            ))}
          </div>
        </section>

        <section className="card" style={{ marginTop: 13, padding: 19 }}>
          <div className="row-between">
            <h2 style={{ fontSize: 18 }}>旅の好み</h2>
            <Map size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          {PREFERENCE_BARS.map((b) => (
            <div className="pref" key={b.title}>
              <div className="pref-title">
                <h3 style={{ fontSize: 14 }}>{b.title}</h3>
                {b.count >= 3 && <b>{b.word}</b>}
              </div>
              <div className="pref-labels">
                <span>{b.left}</span>
                <span>{b.right}</span>
              </div>
              {b.count >= 3 ? (
                <div className="pref-track"><i style={{ left: `${b.position * 100}%` }} /></div>
              ) : (
                <p className="sub" style={{ marginTop: 6 }}>あと{3 - b.count}回答えると見えてきます</p>
              )}
            </div>
          ))}
        </section>

        <PrivacyNote>この傾向は、あなたにだけ表示されます</PrivacyNote>
      </main>
    </>
  );
}
