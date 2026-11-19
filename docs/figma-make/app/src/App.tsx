import { useEffect, useMemo, useState } from "react";

type Screen =
  | "start"
  | "invite"
  | "diagnosis"
  | "ratingGuide"
  | "rating"
  | "draft"
  | "home"
  | "trips"
  | "visited"
  | "tendency";

const PHOTO =
  "https://images.unsplash.com/photo-1546954892-64c1c0aed544?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900";

const WISH_SUGGESTIONS = [
  {
    place: "山形・銀山温泉",
    title: "雪明かりの温泉街へ",
    copy: "まだ一緒に旅したことのない人にも、気軽に声をかけてみませんか。",
    image:
      "https://images.unsplash.com/photo-1517918558653-3a2c5ab393a2?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900",
    alt: "雪に包まれた日本の木造家屋",
    badge: "いまが見頃",
  },
  {
    place: "山形・蔵王",
    title: "樹氷の森を歩く冬旅",
    copy: "ひとりで計画を始めて、行きたそうな友人へあとから共有できます。",
    image:
      "https://images.unsplash.com/photo-1673751243582-6d3d33cf136d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900",
    alt: "雪に覆われた木々と静かな公園",
    badge: "あなたへのおすすめ",
  },
  {
    place: "岐阜・白川郷",
    title: "雪の合掌造りに泊まる",
    copy: "いつもの旅仲間だけでなく、あの人とも行けるかもしれない旅です。",
    image:
      "https://images.unsplash.com/photo-1644836512182-977899856efe?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900",
    alt: "雪景色の中に建つ合掌造りの家",
    badge: "行きたいに近い旅",
  },
];

const MORE_DISCOVERIES = [
  {
    place: "山形・山寺",
    title: "雪の石段と、静かな朝",
    detail: "東京から約3時間30分 ・ 日帰りから",
    tags: ["雪景色", "歴史", "朝旅"],
    image:
      "https://images.unsplash.com/photo-1610623757180-f5ec7090a07f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=500",
    alt: "雪に囲まれた赤い寺院",
  },
  {
    place: "長野・渋温泉",
    title: "九つの外湯をめぐる温泉街",
    detail: "東京から約3時間 ・ 1泊がおすすめ",
    tags: ["温泉", "街歩き", "友人"],
    image:
      "https://images.unsplash.com/photo-1673751243256-d744af8a4dda?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=500",
    alt: "雪をまとった木と冬の建物",
  },
  {
    place: "山梨・河口湖",
    title: "冬の富士山を眺める週末",
    detail: "東京から約2時間 ・ 日帰りから",
    tags: ["絶景", "カフェ", "ひとり旅"],
    image:
      "https://images.unsplash.com/photo-1528164344705-47542687000d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=500",
    alt: "富士山と五重塔を望む景色",
  },
  {
    place: "広島・宮島",
    title: "海に浮かぶ鳥居と冬の島旅",
    detail: "東京から約4時間30分 ・ 1泊から",
    tags: ["島", "文化", "食べる"],
    image:
      "https://images.unsplash.com/photo-1693246049389-9fecc67938c1?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=500",
    alt: "水辺に立つ大きな木造の鳥居",
  },
];

const colors = ["#168BFF", "#6868F7", "#B84FD8", "#F34D9B", "#FF5D67"];
const ratingNames = ["行きたくない", "あまり", "どちらでもない", "行きたい", "すごく行きたい"];

const iconPaths: Record<string, React.ReactNode> = {
  back: <path d="m15 18-6-6 6-6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  lock: (
    <>
      <rect width="14" height="10" x="5" y="11" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="19" r="2" />
      <path d="m8 11 8-5M8 13l8 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5a5.5 5.5 0 0 0 1-8.9Z" />
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chart: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
};

function Icon({ name, size = 20, fill = "none" }: { name: string; size?: number; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

function AppMenuButton({ align = "right" }: { align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const go = (screen: Screen) => {
    window.dispatchEvent(new CustomEvent<Screen>("tabion:navigate", { detail: screen }));
    setOpen(false);
  };
  return (
    <div className={`app-menu menu-${align}`}>
      <button
        className="icon-btn"
        onClick={() => setOpen(!open)}
        aria-label="メニュー"
        aria-expanded={open}
      >
        <Icon name="menu" />
      </button>
      {open && (
        <nav className="menu-popover" aria-label="アプリメニュー">
          <button onClick={() => go("home")}>
            <Icon name="heart" />
            <span>
              <b>わたしの行きたい</b>
              <small>気になる旅を見つける</small>
            </span>
          </button>
          <button onClick={() => go("draft")}>
            <Icon name="map" />
            <span>
              <b>旅の工程案</b>
              <small>みんなの予定を確認</small>
            </span>
          </button>
          <button onClick={() => go("visited")}>
            <Icon name="check" />
            <span>
              <b>行った</b>
              <small>これまでの旅の記録</small>
            </span>
          </button>
        </nav>
      )}
    </div>
  );
}

function Header({ title, back }: { title: string; back?: () => void }) {
  return (
    <header className="top-header">
      {back ? (
        <button className="icon-btn" onClick={back} aria-label="戻る">
          <Icon name="back" />
        </button>
      ) : title === "TABI ON" ? (
        <span className="header-spacer" />
      ) : (
        <AppMenuButton align="left" />
      )}
      {title === "TABI ON" ? (
        <span className="header-title wordmark" aria-label="TABI ON たびおん">
          <span className="wordmark-main">
            <b>TABI</b>
            <strong>ON</strong>
          </span>
          <small>たびおん</small>
        </span>
      ) : (
        <span className="header-title">{title}</span>
      )}
      {back ? <AppMenuButton /> : <span className="header-spacer" />}
    </header>
  );
}

function ChoiceGroup({
  title,
  options,
  value,
  onChange,
  multiple = false,
}: {
  title: string;
  options: string[];
  value: string | string[];
  onChange: (v: any) => void;
  multiple?: boolean;
}) {
  const isOn = (option: string) =>
    Array.isArray(value) ? value.includes(option) : value === option;
  const pick = (option: string) => {
    if (!multiple) return onChange(option);
    const current = value as string[];
    onChange(current.includes(option) ? current.filter((v) => v !== option) : [...current, option]);
  };
  return (
    <section className="field-group">
      <h3>{title}</h3>
      <div className="chips">
        {options.map((option) => (
          <button
            key={option}
            className={`chip ${isOn(option) ? "selected" : ""} ${option === "未定" ? "undecided" : ""}`}
            onClick={() => pick(option)}
          >
            {isOn(option) && <Icon name="check" size={15} />}
            {option}
          </button>
        ))}
      </div>
    </section>
  );
}

const diagnosisQuestions = [
  {
    type: "multi",
    title: "今回の旅で、したいことは？",
    sub: "気になるものを、いくつでも",
    options: [
      "食べる",
      "自然・景色",
      "温泉・いやし",
      "体験・アクティビティ",
      "街歩き・買い物",
      "歴史・文化",
    ],
  },
  { type: "scale", title: "旅のペースは？", left: "ゆったり", right: "アクティブ" },
  {
    type: "multi",
    title: "どんな時間を大事にしたい？",
    sub: "複数選べます",
    options: ["みんなで話す", "写真を撮る", "おいしいもの", "非日常を味わう", "のんびりする"],
  },
  { type: "scale", title: "過ごし方の好みは？", left: "予定少なめ", right: "ぎっしり" },
  {
    type: "multi",
    title: "冬なら何をしてみたい？",
    sub: "直感で選んでOK",
    options: ["雪景色を見る", "露天風呂", "郷土料理", "雪あそび", "カフェめぐり"],
  },
  { type: "scale", title: "移動時間はどのくらい平気？", left: "短めがいい", right: "遠くてもOK" },
  {
    type: "multi",
    title: "泊まるなら、どんな宿？",
    sub: "複数選べます",
    options: ["温泉旅館", "ホテル", "古民家・一棟貸し", "コスパ重視", "宿は未定"],
  },
  { type: "scale", title: "行き先の雰囲気は？", left: "定番", right: "穴場" },
  {
    type: "multi",
    title: "食の好みを教えて",
    sub: "食べたいものを、いくつでも",
    options: ["ご当地グルメ", "海鮮", "お肉", "甘いもの", "お酒", "特になし"],
  },
  { type: "scale", title: "予算の気分は？", left: "おさえたい", right: "少し贅沢" },
  {
    type: "place",
    title: "具体的に行きたい場所はある？",
    sub: "なくても大丈夫。思いつく場所を追加できます",
  },
];

function StartScreen({ onNext }: { onNext: (companions: string[]) => void }) {
  const [who, setWho] = useState("友人");
  const [name, setName] = useState("");
  const [companions, setCompanions] = useState(["あや", "みさき", "けんた"]);
  const [months, setMonths] = useState<string[]>(["1月", "2月"]);
  const [nights, setNights] = useState("1泊");
  const [from, setFrom] = useState("東京");
  const [area, setArea] = useState("未定");
  return (
    <div className="screen">
      <Header title="TABI ON" />
      <main className="content start-content">
        <div className="eyebrow">NEW TRIP</div>
        <h1>旅をはじめよう</h1>
        <p className="lead">
          決まっていることだけでOK。
          <br />
          みんなの気持ちから、行き先を見つけます。
        </p>
        <div className="form-card">
          <ChoiceGroup
            title="だれと行く？"
            options={["友人", "恋人", "家族・小さい子あり", "家族・大人のみ", "未定"]}
            value={who}
            onChange={setWho}
          />
          <section className="field-group companion-field">
            <h3>一緒に行く人</h3>
            <p>招待する人の名前を登録してください。あとからでも追加できます。</p>
            <div className="name-input">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    setCompanions([...companions, name.trim()]);
                    setName("");
                  }
                }}
                placeholder="名前を入力"
              />
              <button
                onClick={() => {
                  if (!name.trim()) return;
                  setCompanions([...companions, name.trim()]);
                  setName("");
                }}
              >
                追加
              </button>
            </div>
            <div className="companion-list">
              {companions.map((person) => (
                <span key={person}>
                  {person}
                  <button
                    onClick={() => setCompanions(companions.filter((item) => item !== person))}
                    aria-label={`${person}を外す`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </section>
          <ChoiceGroup
            title="時期"
            options={["1月", "2月", "3月", "未定"]}
            value={months}
            onChange={setMonths}
            multiple
          />
          <ChoiceGroup
            title="何泊？"
            options={["日帰り", "1泊", "2泊", "3泊以上", "未定"]}
            value={nights}
            onChange={setNights}
          />
          <ChoiceGroup
            title="出発地"
            options={["東京", "大阪", "仙台", "その他", "未定"]}
            value={from}
            onChange={setFrom}
          />
          <ChoiceGroup
            title="行き先の地域"
            options={["東北", "関東", "北陸", "どこでも", "未定"]}
            value={area}
            onChange={setArea}
          />
        </div>
      </main>
      <div className="sticky-action">
        <button className="primary-btn" onClick={() => onNext(companions)}>
          次へ：招待コードを発行する
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}

function Invite({
  companions,
  onStart,
  onBack,
}: {
  companions: string[];
  onStart: () => void;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [registered, setRegistered] = useState(false);
  const members = ["あなた", ...companions];
  const copyCode = async () => {
    try {
      await navigator.clipboard?.writeText("TABI-4K7Q");
    } finally {
      setCopied(true);
    }
  };
  return (
    <div className="screen invite-screen">
      <Header title="みんなを招待" back={onBack} />
      <main className="content invite-content">
        <div className="invite-intro">
          <span>INVITATION CODE</span>
          <h1>TABI-4K7Q</h1>
          <p>リンクを開くか、コードを入力して参加できます。アプリがなくても大丈夫です。</p>
        </div>
        <div className="invite-actions">
          <button className="primary-btn" onClick={() => setShared(true)}>
            <Icon name="share" />
            {shared ? "共有メニューを開きました" : "LINEで共有"}
          </button>
          <button className="outline-btn" onClick={copyCode}>
            {copied && <Icon name="check" />}
            {copied ? "コピーしました" : "コードをコピー"}
          </button>
        </div>
        <section className="invite-card">
          <div className="invite-card-title">
            <h2>参加の状況</h2>
            <button>
              <Icon name="plus" size={16} />
              あとから追加
            </button>
          </div>
          {members.map((person, index) => (
            <div className="member-row" key={person}>
              <span className="member-avatar">{person.slice(0, 1)}</span>
              <b>{person}</b>
              <span className={`member-status ${index === 0 ? "answered" : ""}`}>
                {index === 0 ? "回答済み" : "招待中"}
              </span>
            </div>
          ))}
        </section>
        <section className="account-card">
          <span className="account-icon">
            <Icon name="heart" />
          </span>
          <div>
            <h2>回答や旅の記録を残す（任意）</h2>
            <p>作らなくても回答できます</p>
          </div>
          <button onClick={() => setRegistered(true)}>
            {registered ? "登録済み" : "アカウント登録"}
          </button>
        </section>
      </main>
      <div className="sticky-action">
        <button className="primary-btn" onClick={onStart}>
          自分の回答をはじめる
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}

function Scale({
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
      <div className="scale">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(n)} className={value === n ? "active" : ""}>
            <span>{n}</span>
          </button>
        ))}
      </div>
      <div className="neutral-label">3 = どちらでもない</div>
    </div>
  );
}

function Diagnosis({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [place, setPlace] = useState("");
  const question = diagnosisQuestions[step];
  const next = () => (step === 10 ? onDone() : setStep(step + 1));
  return (
    <div className="screen diagnosis">
      <div className="progress-row">
        <button
          className="icon-btn"
          onClick={() => (step ? setStep(step - 1) : onBack())}
          aria-label="戻る"
        >
          <Icon name="back" />
        </button>
        <div className="progress-track">
          <span style={{ width: `${((step + 1) / 11) * 100}%` }} />
        </div>
        <button className="skip-btn" onClick={next}>
          とばす
        </button>
        <AppMenuButton />
      </div>
      <main className="content question-content">
        <div className="trip-summary">1〜2月 ・ 1泊 ・ 友人4人</div>
        <div className="question-count">{step + 1} / 11</div>
        <h1>{question.title}</h1>
        {"sub" in question && <p className="lead">{question.sub}</p>}
        {question.type === "multi" && (
          <div className="answer-list">
            {question.options?.map((option) => {
              const selected = (answers[step] || []).includes(option);
              return (
                <button
                  key={option}
                  className={`answer-option ${selected ? "active" : ""}`}
                  aria-pressed={selected}
                  onClick={() => {
                    const current = answers[step] || [];
                    setAnswers({
                      ...answers,
                      [step]: selected
                        ? current.filter((v: string) => v !== option)
                        : [...current, option],
                    });
                  }}
                >
                  <span className="choice-check" aria-hidden="true">
                    {selected && <Icon name="check" size={18} />}
                  </span>
                  <span className="answer-label">{option}</span>
                </button>
              );
            })}
          </div>
        )}
        {question.type === "scale" && (
          <Scale
            value={answers[step] ?? null}
            onChange={(v) => setAnswers({ ...answers, [step]: v })}
            left={question.left || ""}
            right={question.right || ""}
          />
        )}
        {question.type === "place" && (
          <div className="place-box">
            <label className="search-field">
              <Icon name="search" />
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="銀山温泉、蔵王など"
              />
            </label>
            <button
              className="outline-btn"
              onClick={() => place && setAnswers({ ...answers, [step]: [place] })}
            >
              <Icon name="plus" />
              検索して追加
            </button>
            {answers[step]?.map((p: string) => (
              <div className="added-place" key={p}>
                <Icon name="pin" size={18} />
                <span>{p}</span>
                <button onClick={() => setAnswers({ ...answers, [step]: [] })}>削除</button>
              </div>
            ))}
          </div>
        )}
        <p className="privacy">
          <Icon name="lock" size={15} />
          だれが何を選んだかは表示されません
        </p>
      </main>
      <div className="sticky-action">
        <button className="primary-btn" onClick={next}>
          {step === 10 ? "候補を見てみる" : "次へ"}
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}

const candidates = [
  {
    place: "山形・銀山温泉",
    title: "雪と温泉と、ごはんの旅",
    tags: ["#温泉", "#雪景色", "#郷土料理"],
    price: "約28,000円",
    time: "東京から約3時間30分",
    partner: true,
  },
  {
    place: "山形・蔵王",
    title: "樹氷の中を歩く、冬の冒険",
    tags: ["#樹氷", "#雪あそび", "#絶景"],
    price: "約31,000円",
    time: "東京から約3時間",
    partner: true,
  },
  {
    place: "山形市・かみのやま",
    title: "城下町と湯けむりをめぐる旅",
    tags: ["#街歩き", "#温泉", "#ワイン"],
    price: "約25,000円",
    time: "東京から約2時間40分",
    partner: false,
  },
  {
    place: "宮城・遠刈田温泉",
    title: "雪の森と手仕事にふれる旅",
    tags: ["#温泉", "#工芸", "#カフェ"],
    price: "約27,000円",
    time: "東京から約3時間",
    partner: false,
  },
  {
    place: "秋田・乳頭温泉郷",
    title: "秘湯で深呼吸する旅",
    tags: ["#秘湯", "#雪景色"],
    price: "約34,000円",
    time: "東京から約4時間",
    partner: false,
  },
  {
    place: "福島・会津若松",
    title: "雪の城下町と郷土料理の旅",
    tags: ["#歴史", "#郷土料理"],
    price: "約26,000円",
    time: "東京から約3時間",
    partner: false,
  },
  {
    place: "新潟・越後湯沢",
    title: "雪あそびと米どころの旅",
    tags: ["#雪あそび", "#日本酒"],
    price: "約29,000円",
    time: "東京から約1時間20分",
    partner: true,
  },
  {
    place: "群馬・四万温泉",
    title: "レトロな温泉街でほどける旅",
    tags: ["#温泉", "#街歩き"],
    price: "約24,000円",
    time: "東京から約3時間",
    partner: false,
  },
];

function RatingGuide({
  onStart,
  onSkip,
  onBack,
}: {
  onStart: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div className="screen guide-screen">
      <Header title="おすすめができました" back={onBack} />
      <main className="content guide-content">
        <div className="guide-symbol" aria-hidden="true">
          {colors.map((color) => (
            <i key={color} style={{ background: color }} />
          ))}
        </div>
        <h1>
          行きたい気持ちを、
          <br />
          ひとつずつ選ぼう
        </h1>
        <p>
          あなたの回答の傾向から、おすすめの行き先です。それぞれに行きたい度合いを選んで、みんなでプランを作りましょう。選ぶと、次の候補に進みます。
        </p>
        <div className="rating-sample">
          <div>
            {colors.map((color) => (
              <i key={color} style={{ background: color }} />
            ))}
          </div>
          <span>行きたくない</span>
          <span>すごく行きたい</span>
        </div>
      </main>
      <div className="guide-actions">
        <button className="primary-btn" onClick={onStart}>
          はじめる
          <Icon name="chevron" />
        </button>
        <button className="text-btn" onClick={onSkip}>
          とばして、旅の工程案を見る
        </button>
      </div>
    </div>
  );
}

function Rating({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const ratingCandidates = candidates.slice(0, 5);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const [cardMotion, setCardMotion] = useState<"idle" | "left" | "right" | "up">("idle");
  const item = ratingCandidates[index];
  const selected = ratings[index];
  const choose = (n: number) => {
    if (cardMotion !== "idle") return;
    const nextRatings = { ...ratings, [index]: n };
    setRatings(nextRatings);
    setCardMotion(n <= 2 ? "left" : n >= 4 ? "right" : "up");
    window.setTimeout(() => {
      if (Object.keys(nextRatings).length === ratingCandidates.length) {
        setFinished(true);
      } else {
        const nextUnanswered = ratingCandidates.findIndex(
          (_, candidateIndex) => candidateIndex > index && !nextRatings[candidateIndex],
        );
        const firstUnanswered = ratingCandidates.findIndex(
          (_, candidateIndex) => !nextRatings[candidateIndex],
        );
        setIndex(nextUnanswered >= 0 ? nextUnanswered : firstUnanswered);
      }
      setCardMotion("idle");
    }, 430);
  };
  if (finished) {
    return (
      <div className="screen completed-screen">
        <Header title="行きたい度合い" back={() => setFinished(false)} />
        <main className="content completed-content">
          <span className="completed-check">
            <Icon name="check" size={36} />
          </span>
          <h1>ぜんぶ選び終わりました</h1>
          <p>あなたの気持ちは、みんなの工程案に反映されます。</p>
          <button className="primary-btn" onClick={onDone}>
            旅の工程案を見る
            <Icon name="chevron" />
          </button>
        </main>
      </div>
    );
  }
  return (
    <div className="screen">
      <Header title="行きたい度合い" back={onBack} />
      <main className="content rating-content">
        <div className="candidate-nav">
          <button disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="前の候補">
            <Icon name="back" />
          </button>
          <b>
            {index + 1} / {ratingCandidates.length}
          </b>
          <button
            disabled={index === ratingCandidates.length - 1}
            onClick={() => setIndex(index + 1)}
            aria-label="次の候補をとばす"
          >
            <Icon name="chevron" />
          </button>
        </div>
        <div className="candidate-stage">
          <article
            key={index}
            className={`candidate-card card-enter ${cardMotion !== "idle" ? `card-exit-${cardMotion}` : ""}`}
          >
            <div
              className="heat-band"
              style={{ backgroundColor: selected ? colors[selected - 1] : "#DED7D0" }}
            />
            <img src={PHOTO} alt="雪に包まれた山形の山々" />
            <div className="candidate-body">
              <div className="place-row">
                <span>{item.place}</span>
                {item.partner && <b>提携の体験あり</b>}
              </div>
              <h1>{item.title}</h1>
              <div className="tags">
                {item.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="facts">
                <span>
                  {item.price}
                  <small> / ひとり</small>
                </span>
                <span>{item.time}</span>
              </div>
            </div>
          </article>
          {cardMotion !== "idle" && selected && (
            <span className={`choice-feedback feedback-${cardMotion}`}>
              <Icon name="check" size={17} />
              {ratingNames[selected - 1]}
            </span>
          )}
        </div>
        <section className="rating-panel">
          <h2>ここに、どのくらい行きたい？</h2>
          <div className="rating-options">
            {colors.map((color, i) => (
              <button
                key={color}
                onClick={() => choose(i + 1)}
                className={selected === i + 1 ? "active" : ""}
                disabled={cardMotion !== "idle"}
              >
                <span className="rating-dot" style={{ backgroundColor: color }}>
                  {selected === i + 1 && <Icon name="check" size={20} />}
                </span>
                <span>{ratingNames[i]}</span>
              </button>
            ))}
          </div>
        </section>
        <button className="skip-remaining" onClick={onDone}>
          残りはとばして、工程案へ
        </button>
      </main>
    </div>
  );
}

type DraftItem = { id: number; title: string; meta: string; heat: number; fixed?: boolean };

function Draft({ onHome, onBack }: { onHome: () => void; onBack: () => void }) {
  const [items, setItems] = useState<DraftItem[]>([
    {
      id: 1,
      title: "蔵王の樹氷を見に行く",
      meta: "11:00〜 ・ 蔵王ロープウェイ",
      heat: 4,
      fixed: true,
    },
    { id: 2, title: "山形名物の芋煮ランチ", meta: "13:30〜 ・ 山形駅周辺", heat: 3 },
    { id: 3, title: "銀山温泉をそぞろ歩き", meta: "16:00〜 ・ 銀山温泉街", heat: 5 },
    { id: 4, title: "雪見露天風呂で朝湯", meta: "9:00〜 ・ 銀山温泉", heat: 5 },
    { id: 5, title: "山形の手仕事にふれる", meta: "11:30〜 ・ 工房見学", heat: 2 },
  ]);
  const [menu, setMenu] = useState<number | null>(null);
  const toggleFix = (id: number) =>
    setItems(items.map((x) => (x.id === id ? { ...x, fixed: !x.fixed } : x)));
  const remove = (id: number) => setItems(items.filter((x) => x.id !== id));
  const Day = ({ day, list }: { day: string; list: DraftItem[] }) => (
    <section className="day-section">
      <div className="day-title">
        <span>{day}</span>
        <i />
      </div>
      {list.map((item) => (
        <article key={item.id} className={`draft-item ${item.fixed ? "fixed" : ""}`}>
          <span className="mini-heat" style={{ background: colors[item.heat - 1] }} />
          <div className="draft-copy">
            {item.fixed && (
              <b>
                <Icon name="pin" size={13} />
                絶対行く
              </b>
            )}
            <h3>{item.title}</h3>
            <p>{item.meta}</p>
            <div className="draft-responses" aria-label="みんなの行きたい度合い">
              <span>みんな</span>
              <i style={{ background: colors[item.heat - 1] }} />
              <i style={{ background: colors[Math.max(0, item.heat - 2)] }} />
              <i style={{ background: colors[Math.min(4, item.heat)] }} />
            </div>
          </div>
          <button
            className="more-btn"
            onClick={() => setMenu(menu === item.id ? null : item.id)}
            aria-label="メニュー"
          >
            •••
          </button>
          {menu === item.id && (
            <div className="item-menu">
              <button onClick={() => setMenu(null)}>入れ替える</button>
              <button onClick={() => remove(item.id)}>外す</button>
              <button
                onClick={() => {
                  toggleFix(item.id);
                  setMenu(null);
                }}
              >
                {item.fixed ? "固定を外す" : "絶対行くにする"}
              </button>
            </div>
          )}
        </article>
      ))}
      <button className="add-card">
        <Icon name="plus" size={18} />
        候補から足す
      </button>
    </section>
  );
  return (
    <div className="screen draft-screen">
      <Header title="旅の工程案" back={onBack} />
      <main className="content draft-content">
        <div className="draft-head">
          <div>
            <span>工程案・</span>
            <h1>冬の山形、温泉と雪景色</h1>
          </div>
          <b>3 / 4人の回答</b>
        </div>
        <div className="update-note">
          <span>
            <Icon name="users" size={17} />
          </span>
          3人目の回答で更新しました
        </div>
        <Day day="1日目" list={items.slice(0, 3)} />
        <Day day="2日目" list={items.slice(3)} />
      </main>
      <div className="double-action">
        <button className="secondary-btn">
          <Icon name="share" />
          LINEで共有
        </button>
        <button className="primary-btn" onClick={onHome}>
          これで決まり
        </button>
      </div>
    </div>
  );
}

function Home({ setScreen }: { setScreen: (s: Screen) => void }) {
  const [shared, setShared] = useState<number | null>(null);
  return (
    <div className="screen home-screen">
      <Header title="わたしの行きたい" />
      <main className="content home-content">
        <section className="home-prompt">
          <span>NEXT WISH</span>
          <h1>次は、誰とどこへ行こう。</h1>
          <p>ひとりで考え始めても大丈夫。できた工程案から、誰かを誘えます。</p>
        </section>
        <div className="wish-carousel" aria-label="おすすめの行き先">
          {WISH_SUGGESTIONS.map((suggestion, index) => (
            <article className="wish-suggestion" key={suggestion.place}>
              <div className="suggestion-image">
                <img src={suggestion.image} alt={suggestion.alt} />
                <span>{suggestion.badge}</span>
              </div>
              <div className="suggestion-body">
                <small>{suggestion.place}</small>
                <h2>{suggestion.title}</h2>
                <p>{suggestion.copy}</p>
                <div className="suggestion-actions">
                  <button className="share-wish" onClick={() => setShared(index)}>
                    <Icon name={shared === index ? "check" : "share"} size={17} />
                    {shared === index ? "共有しました" : "行きたいを共有"}
                  </button>
                  <button className="plan-wish" onClick={() => setScreen("start")}>
                    工程案を作る
                    <Icon name="chevron" size={17} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="swipe-hint">
          <span />
          <span />
          <span />
          横にスワイプして見る
        </div>
        <section className="more-discoveries">
          <div className="section-heading discovery-heading">
            <div>
              <span>MORE IDEAS</span>
              <h2>まだ行けていない場所から</h2>
              <p>上のおすすめとは違う切り口で、気になる場所を集めました。</p>
            </div>
          </div>
          <div className="discovery-list">
            {MORE_DISCOVERIES.map((place) => (
              <button
                className="discovery-row"
                key={place.place}
                onClick={() => setScreen("start")}
              >
                <img src={place.image} alt={place.alt} />
                <span className="discovery-copy">
                  <small>{place.place}</small>
                  <b>{place.title}</b>
                  <em>{place.detail}</em>
                  <span className="discovery-tags">
                    {place.tags.map((tag) => (
                      <i key={tag}>#{tag}</i>
                    ))}
                  </span>
                </span>
                <span className="discovery-go">
                  <Icon name="chevron" size={17} />
                </span>
              </button>
            ))}
          </div>
        </section>
        <button className="tendency-card" onClick={() => setScreen("tendency")}>
          <span className="chart-icon">
            <Icon name="chart" />
          </span>
          <span>
            <b>あなたの旅の傾向</b>
            <small>これまでの「行きたい」からわかること</small>
          </span>
          <Icon name="chevron" />
        </button>
      </main>
    </div>
  );
}

function Placeholder({
  type,
  setScreen,
}: {
  type: "trips" | "visited";
  setScreen: (s: Screen) => void;
}) {
  return (
    <div className="screen">
      <Header title={type === "trips" ? "旅の工程案" : "行った"} />
      <main className="content empty-state">
        <span>
          <Icon name={type === "trips" ? "map" : "check"} size={30} />
        </span>
        <h1>{type === "trips" ? "冬の山形、温泉と雪景色" : "旅の思い出"}</h1>
        <p>{type === "trips" ? "1月18日〜19日 ・ 友人4人" : "行った場所がここにたまります"}</p>
        {type === "trips" && (
          <button className="outline-btn" onClick={() => setScreen("draft")}>
            旅の工程案を見る
          </button>
        )}
      </main>
    </div>
  );
}

function Tendency({ back }: { back: () => void }) {
  const bars = [
    { title: "旅のペース", left: "ゆったり", right: "アクティブ", hot: 2, result: "バランス派" },
    {
      title: "過ごし方",
      left: "予定少なめ",
      right: "ぎっしり",
      hot: 3,
      result: "少し充実させたい",
    },
    { title: "移動", left: "短めがいい", right: "遠くてもOK", hot: 3, result: "遠出も楽しめる" },
    { title: "行き先", left: "定番", right: "穴場", hot: 4, result: "まだ知らない場所へ" },
  ];
  return (
    <div className="screen">
      <Header title="あなたの旅の傾向" back={back} />
      <main className="content tendency-content">
        <section className="tendency-intro tendency-hero">
          <div className="tendency-hero-icon">
            <Icon name="chart" size={25} />
          </div>
          <div>
            <span>MY TRAVEL STYLE</span>
            <h1>
              温泉と雪景色に、
              <br />
              心が動くみたい。
            </h1>
            <p>これまでの12件の「行きたい」から</p>
          </div>
          <div className="legend">
            <span>
              <i style={{ background: colors[0] }} />
              ひかえめ
            </span>
            <span>
              <i style={{ background: colors[4] }} />
              強い気持ち
            </span>
          </div>
        </section>
        <section className="trend-section trend-card">
          <div className="trend-heading">
            <div>
              <small>WHAT YOU LOVE</small>
              <h2>よく選ぶ「したいこと」</h2>
            </div>
            <Icon name="heart" size={20} />
          </div>
          <div className="trend-chips">
            <span className="trend-hot">温泉・いやし</span>
            <span className="trend-warm">自然・景色</span>
            <span className="trend-mid">食べる</span>
            <span className="trend-cool">歴史・文化</span>
            <span className="trend-cold">買い物</span>
          </div>
        </section>
        <section className="trend-section trend-card preference-card">
          <div className="trend-heading">
            <div>
              <small>YOUR PREFERENCES</small>
              <h2>旅の好み</h2>
            </div>
            <Icon name="map" size={20} />
          </div>
          {bars.map((bar) => (
            <div className="preference" key={bar.title}>
              <div className="preference-title">
                <h3>{bar.title}</h3>
                <b>{bar.result}</b>
              </div>
              <div className="preference-labels">
                <span>{bar.left}</span>
                <span>{bar.right}</span>
              </div>
              <div className="preference-track">
                <i style={{ left: `${(bar.hot / 4) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>
        <p className="private-note">
          <Icon name="lock" size={16} />
          この傾向は、あなたにだけ表示されます
        </p>
      </main>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [companions, setCompanions] = useState(["あや", "みさき", "けんた"]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);
  useEffect(() => {
    const navigate = (event: Event) => setScreen((event as CustomEvent<Screen>).detail);
    window.addEventListener("tabion:navigate", navigate);
    return () => window.removeEventListener("tabion:navigate", navigate);
  }, []);
  const view = useMemo(() => {
    if (screen === "start")
      return (
        <StartScreen
          onNext={(names) => {
            setCompanions(names);
            setScreen("invite");
          }}
        />
      );
    if (screen === "invite")
      return (
        <Invite
          companions={companions}
          onBack={() => setScreen("start")}
          onStart={() => setScreen("diagnosis")}
        />
      );
    if (screen === "diagnosis")
      return (
        <Diagnosis onBack={() => setScreen("invite")} onDone={() => setScreen("ratingGuide")} />
      );
    if (screen === "ratingGuide")
      return (
        <RatingGuide
          onBack={() => setScreen("diagnosis")}
          onStart={() => setScreen("rating")}
          onSkip={() => setScreen("draft")}
        />
      );
    if (screen === "rating")
      return <Rating onBack={() => setScreen("ratingGuide")} onDone={() => setScreen("draft")} />;
    if (screen === "draft")
      return <Draft onBack={() => setScreen("rating")} onHome={() => setScreen("home")} />;
    if (screen === "home") return <Home setScreen={setScreen} />;
    if (screen === "trips" || screen === "visited")
      return <Placeholder type={screen} setScreen={setScreen} />;
    return <Tendency back={() => setScreen("home")} />;
  }, [screen, companions]);
  return <div className="app-shell">{view}</div>;
}
