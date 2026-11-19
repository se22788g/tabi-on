/** データを読んでいる間の表示。5つの色の丸がゆっくり波打つ（F5 と同じ動き） */
export function Loading() {
  return (
    <main className="screen content" role="status" aria-live="polite">
      <div className="guide-center">
        <div className="wave" aria-hidden="true" style={{ justifyContent: "center" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} className={`bg-rate rate-${i}`} style={{ ["--i" as string]: i } as React.CSSProperties} />
          ))}
        </div>
        <span className="sr-only">読み込み中</span>
      </div>
    </main>
  );
}

/** Supabase の設定がない・つながらないときの案内（開発中だけ見える） */
export function SetupNotice({ status }: { status: "unconfigured" | "failed" }) {
  // TODO(spec): この案内の文言は、文言一覧にない（開発者向けの仮の文言）。
  return (
    <main className="screen content">
      <div style={{ paddingTop: 40 }}>
        <h1>{status === "unconfigured" ? "Supabase が設定されていません" : "Supabase につながりません"}</h1>
        <p className="lead">
          {status === "unconfigured"
            ? ".env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を入れて、開発サーバーを入れ直してください。"
            : "匿名ログインがオンか、URL とキーが合っているかを確かめてください（supabase/README.md）。"}
        </p>
      </div>
    </main>
  );
}
