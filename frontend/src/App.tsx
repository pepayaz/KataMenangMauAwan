import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  FileText,
  Fingerprint,
  History,
  Layers3,
  Lightbulb,
  LoaderCircle,
  Menu,
  MessageSquareQuote,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  examples,
  readHistory,
  storageKey,
  type DemoId,
  type HistoryItem,
} from "./demo";

type Page = "check" | "history" | "saved" | "guide";
const steps = [
  "Mengenali emiten dan klaim",
  "Membandingkan angka pada fixture",
  "Mencari konteks yang terlewat",
  "Menyusun rapor demo",
];

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <span className="eyebrow">CEK DULU / CATATAN</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Tutup dialog"
        >
          <X size={20} />
        </button>
      </div>
      <h2>{title}</h2>
      {children}
      <button className="primary-button" onClick={onClose}>
        Mengerti <Check size={17} />
      </button>
    </dialog>
  );
}

function SignalArt() {
  return (
    <div className="signal-art" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <span className="art-coordinate">SIGNAL / NOISE</span>
      <div className="floating-claim">
        <span className="mini-avatar">a</span>
        <div>
          <b>Katanya cuan terus?</b>
          <span>Terlalu bagus untuk langsung percaya.</span>
        </div>
        <MessageSquareQuote size={18} />
      </div>
      <div className="signal-card">
        <div className="signal-card-top">
          <span>
            <span className="status-dot" /> CONTEXT FOUND
          </span>
          <ArrowUpRight size={18} />
        </div>
        <div className="signal-number">
          25<span>%</span>
          <span className="number-asterisk">*</span>
        </div>
        <svg viewBox="0 0 260 58" className="art-chart">
          <path d="M0 48H260M0 24H260" stroke="currentColor" opacity=".08" />
          <path
            d="M0 49 23 43 44 47 62 28 83 35 103 20 124 29 148 3 169 31 191 37 215 41 236 37 260 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <circle
            cx="148"
            cy="3"
            r="4"
            fill="var(--accent)"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        <div className="signal-foot">
          <span>* Ada konteks yang hilang.</span>
          <Search size={16} />
        </div>
      </div>
      <div className="verified-stamp">
        <ShieldCheck size={23} />
        <span>
          Fakta dulu.
          <br />
          <b>Baru percaya.</b>
        </span>
      </div>
      <span className="art-caption">LOOK BEYOND THE NUMBERS ↗</span>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("check");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>(readHistory);
  const [active, setActive] = useState<HistoryItem | null>(null);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [modal, setModal] = useState<"about" | "evidence" | null>(null);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [storageError, setStorageError] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeFixture = examples.find(
    (example) => example.id === active?.demoId,
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [history]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  function navigate(next: Page) {
    setPage(next);
    setMobileMenu(false);
    setQuery("");
    setFilter("Semua");
  }
  function chooseExample(id: DemoId) {
    const example = examples.find((item) => item.id === id)!;
    setInput(example.text);
    inputRef.current?.focus();
  }
  function startCheck() {
    if (!input.trim() || running) return;
    timers.current.forEach(clearTimeout);
    setRunning(true);
    setActive(null);
    setStep(0);
    const text = input.trim();
    const demoId =
      examples.find((example) => example.text === text)?.id || "custom";
    steps
      .slice(1)
      .forEach((_, index) =>
        timers.current.push(
          setTimeout(() => setStep(index + 1), (index + 1) * 650),
        ),
      );
    timers.current.push(
      setTimeout(() => {
        const result: HistoryItem = {
          id: crypto.randomUUID(),
          demoId,
          text,
          createdAt: new Date().toISOString(),
          saved: false,
        };
        setHistory((items) => [result, ...items].slice(0, 50));
        setActive(result);
        setRunning(false);
        timers.current.push(
          setTimeout(
            () =>
              resultRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              }),
            80,
          ),
        );
      }, 2800),
    );
  }
  function toggleSave(item: HistoryItem) {
    const saved = !history.find((entry) => entry.id === item.id)?.saved;
    setHistory((items) =>
      items.map((entry) =>
        entry.id === item.id ? { ...entry, saved } : entry,
      ),
    );
    setActive((current) =>
      current?.id === item.id ? { ...current, saved } : current,
    );
    setToast(
      saved
        ? "Rapor ditambahkan ke koleksi tersimpan."
        : "Rapor dihapus dari koleksi tersimpan.",
    );
  }
  function openReport(item: HistoryItem) {
    setActive(item);
    setInput(item.text);
    navigate("check");
    timers.current.push(
      setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: "smooth" }),
        80,
      ),
    );
  }

  const nav = [
    { id: "check" as const, label: "Cek klaim", icon: Search },
    { id: "history" as const, label: "Riwayat cek", icon: History },
    { id: "saved" as const, label: "Tersimpan", icon: Bookmark },
  ];
  const filteredHistory = history.filter(
    (item) =>
      (page !== "saved" || item.saved) &&
      item.text.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "Semua" ||
        examples.find((example) => example.id === item.demoId)?.status ===
          filter),
  );

  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="Tutup menu"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenu ? "is-open" : ""}`}>
        <a
          href="#"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            navigate("check");
          }}
        >
          <span className="brand-mark">
            <CheckCheck size={26} strokeWidth={3} />
          </span>
          <span>
            cek<span className="brand-light">dulu</span>
            <span className="brand-period">.</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="status-dot" /> RUANG INVESTOR RASIONAL
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Navigasi utama">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => navigate(id)}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "check" ? (
                <span className="nav-shortcut">↗</span>
              ) : (
                <span className="nav-count">
                  {id === "history"
                    ? history.length
                    : history.filter((item) => item.saved).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-divider" />
        <button
          className={`nav-item ${page === "guide" ? "active" : ""}`}
          onClick={() => navigate("guide")}
        >
          <CircleHelp size={19} />
          <span>Cara kerja</span>
          <ArrowUpRight size={15} />
        </button>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="note-icon">
              <Lightbulb size={21} />
            </div>
            <h3>
              Jangan buru-buru
              <br />
              percaya.
            </h3>
            <p>Klaim yang viral belum tentu cerita yang utuh.</p>
            <button onClick={() => navigate("guide")}>
              Kenali cara kami bekerja <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="profile" onClick={() => setModal("about")}>
            <span className="profile-avatar">R</span>
            <span>
              <b>Ruang eksplorasi</b>
              <small>Akses demo frontend</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Buka menu"
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>
              {page === "check"
                ? "Cek klaim"
                : page === "history"
                  ? "Riwayat cek"
                  : page === "saved"
                    ? "Tersimpan"
                    : "Cara kerja"}
            </b>
          </div>
          <div className="topbar-right">
            <span className="demo-pill">
              <span className="status-dot" /> Mode demo
            </span>
            <span className="topbar-divider" />
            <button className="about-button" onClick={() => setModal("about")}>
              Tentang Cek Dulu <ArrowUpRight size={14} />
            </button>
          </div>
        </header>
        <main>
          {page === "check" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <div className="eyebrow hero-eyebrow">
                    <span className="tiny-line" /> LESS NOISE. MORE CONTEXT.
                  </div>
                  <h1>
                    Katanya cuan.
                    <br />
                    <span>Cek dulu faktanya.</span>
                    <span className="heading-spark">✳</span>
                  </h1>
                  <p>
                    Di balik klaim saham yang ramai, ada fakta yang perlu
                    dipahami.
                    <br className="desktop-break" /> Periksa angkanya. Temukan
                    konteksnya. Putuskan sendiri.
                  </p>
                  <div className="hero-benefits">
                    <span>
                      <Check size={13} /> Berbasis bukti
                    </span>
                    <span>
                      <Check size={13} /> Transparan
                    </span>
                    <span>
                      <Check size={13} /> Bebas hype
                    </span>
                  </div>
                </div>
                <SignalArt />
              </section>
              <div className="section-heading">
                <div>
                  <span className="section-index">01 /</span>
                  <h2>Mulai dari sebuah klaim</h2>
                </div>
                <span className="quiet-label">
                  <Fingerprint size={14} /> Pikiran kritis, keputusan mandiri.
                </span>
              </div>
              <div className="check-layout">
                <section className="input-card">
                  <div className="input-card-heading">
                    <span>
                      <MessageSquareQuote size={19} /> Apa yang kamu dengar?
                    </span>
                    <span className="text-label">TEKS KLAIM</span>
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      startCheck();
                    }}
                  >
                    <label className="sr-only" htmlFor="claim">
                      Teks klaim saham
                    </label>
                    <textarea
                      id="claim"
                      ref={inputRef}
                      value={input}
                      maxLength={2000}
                      disabled={running}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder={
                        "“Katanya yield dividen ADRO 25% setahun.\nBeneran segampang itu?”"
                      }
                    />
                    <div className="input-meta">
                      <span>
                        Tempel klaim dari X, TikTok, atau grup obrolan.
                      </span>
                      <span>
                        {input.length.toLocaleString("id-ID")} / 2.000
                      </span>
                    </div>
                    <div className="example-row">
                      <span>Coba contoh</span>
                      {examples.map((example) => (
                        <button
                          key={example.id}
                          type="button"
                          disabled={running}
                          onClick={() => chooseExample(example.id)}
                          className={`example-chip ${input === example.text ? "selected" : ""}`}
                        >
                          {example.ticker}
                          <span>{example.category}</span>
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                    <div className="input-card-footer">
                      <span>
                        <ShieldCheck size={15} /> Tanpa login. Mulai dari rasa
                        penasaran.
                      </span>
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={!input.trim() || running}
                      >
                        {running ? (
                          <>
                            <LoaderCircle className="spin" size={17} />{" "}
                            Memeriksa...
                          </>
                        ) : (
                          <>
                            Cek klaim ini <ArrowRight size={17} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </section>
                <aside className="context-card">
                  <div className="context-card-top">
                    <span className="context-icon">
                      <Layers3 size={22} />
                    </span>
                    <span className="small-tag">THE CONTEXT HUNTER</span>
                  </div>
                  <h3>
                    Benar angkanya.
                    <br />
                    Belum tentu
                    <br />
                    <em>utuh ceritanya.</em>
                  </h3>
                  <p>
                    Kami mencari konteks yang terlewat, bukan sekadar
                    mencocokkan angka.
                  </p>
                  <button onClick={() => navigate("guide")}>
                    Kenapa konteks penting? <ArrowUpRight size={17} />
                  </button>
                  <div className="context-decoration" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </aside>
              </div>
              <div className="demo-notice">
                <span className="status-dot" />
                <span>
                  Ini ruang demo. Pilih contoh untuk menjelajahi rapor
                  ilustratif; teks lain belum dapat diverifikasi.
                </span>
                <span className="notice-label">NO LIVE DATA</span>
              </div>

              {running && (
                <section
                  className="progress-card"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="progress-title">
                    <span className="scanner-icon">
                      <Search size={22} />
                    </span>
                    <div>
                      <span className="eyebrow">SIMULASI PEMERIKSAAN</span>
                      <h3>Mencari cerita di balik angka...</h3>
                    </div>
                    <span className="progress-fraction">
                      0{step + 1}
                      <span> / 04</span>
                    </span>
                  </div>
                  <div className="steps">
                    {steps.map((label, index) => (
                      <div
                        className={`step ${index <= step ? "done" : ""}`}
                        key={label}
                      >
                        <span>
                          {index < step ? <Check size={13} /> : index + 1}
                        </span>
                        <p>{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${(step + 1) * 25}%` }} />
                  </div>
                </section>
              )}

              {active && !running && (
                <section
                  className="report-section"
                  ref={resultRef}
                  tabIndex={-1}
                >
                  <div className="section-heading">
                    <div>
                      <span className="section-index">02 /</span>
                      <h2>Di balik klaim</h2>
                      <span className="small-tag">RAPOR DEMO</span>
                    </div>
                    <button
                      className={`text-button ${active.saved ? "is-saved" : ""}`}
                      onClick={() => toggleSave(active)}
                    >
                      <Bookmark
                        size={16}
                        fill={active.saved ? "currentColor" : "none"}
                      />
                      {active.saved ? "Tersimpan" : "Simpan rapor"}
                    </button>
                  </div>
                  <div className="report-card">
                    <div className="report-main">
                      <div
                        className={`verdict ${activeFixture?.tone || "neutral"}`}
                      >
                        <span className="status-dot" />
                        {activeFixture?.status || "Tidak bisa diverifikasi"}
                      </div>
                      <h2>
                        {activeFixture?.title ||
                          "Klaim baru, perlu data sungguhan."}
                      </h2>
                      <blockquote>“{active.text}”</blockquote>
                      <p>
                        {activeFixture?.summary ||
                          "Frontend ini belum terhubung ke backend. Teks kamu tersimpan sebagai percobaan, tetapi kami belum dapat memeriksa kebenarannya. Gunakan salah satu contoh untuk melihat tampilan hasil pemeriksaan."}
                      </p>
                      {activeFixture && (
                        <div className="context-finding">
                          <Sparkles size={19} />
                          <div>
                            <span>CONTEXT HUNTER</span>
                            <h4>{activeFixture.context}</h4>
                            <p>{activeFixture.detail}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="report-evidence">
                      <div className="evidence-heading">
                        <ChartNoAxesCombined size={18} />
                        <h3>
                          {activeFixture
                            ? "Biar angka bicara."
                            : "Belum ada evidence."}
                        </h3>
                      </div>
                      <span className="eyebrow">
                        {activeFixture
                          ? `${activeFixture.ticker} / ${activeFixture.category} / ILUSTRASI`
                          : "MENUNGGU INTEGRASI BACKEND"}
                      </span>
                      {activeFixture ? (
                        <>
                          <div className="metric-list">
                            {activeFixture.metrics.map((metric, index) => (
                              <div className="metric" key={metric.label}>
                                <div>
                                  <span>{metric.label}</span>
                                  <b>{metric.value}</b>
                                </div>
                                <div className="metric-track">
                                  <span
                                    className={index === 0 ? "claimed" : ""}
                                    style={{ width: `${metric.width}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <button
                            className="evidence-button"
                            onClick={() => setModal("evidence")}
                          >
                            <FileText size={16} /> Lihat catatan bukti{" "}
                            <ArrowUpRight size={15} />
                          </button>
                          <p className="evidence-disclaimer">
                            Data ilustrasi, bukan data pasar terkini.
                          </p>
                        </>
                      ) : (
                        <div className="no-evidence">
                          <Search size={32} />
                          <p>
                            Tidak ada angka yang ditampilkan tanpa data
                            pembanding.
                          </p>
                          <button
                            className="text-button"
                            onClick={() => {
                              chooseExample("dividend");
                              inputRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                            }}
                          >
                            Pakai contoh ADRO <ArrowRight size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <section className="explore-section">
                <div className="section-heading">
                  <div>
                    <span className="section-index">
                      {active ? "03" : "02"} /
                    </span>
                    <h2>Klaim populer, kita bedah.</h2>
                  </div>
                  <span className="quiet-label">
                    Kenali polanya sebelum percaya <ArrowDownLeft size={15} />
                  </span>
                </div>
                <div className="example-grid">
                  {examples.map((example) => (
                    <button
                      disabled={running}
                      className="explore-card"
                      key={example.id}
                      onClick={() => {
                        chooseExample(example.id);
                        inputRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                      }}
                    >
                      <div className="explore-top">
                        <span className={`ticker-icon ticker-${example.id}`}>
                          {example.ticker.slice(0, 1)}
                        </span>
                        <span>
                          <b>{example.ticker}</b>
                          <small>{example.category}</small>
                        </span>
                        <ArrowUpRight size={20} />
                      </div>
                      <h3>
                        {example.id === "dividend"
                          ? "“Dividen 25% setahun. Tinggal duduk manis?”"
                          : example.id === "valuation"
                            ? "“PER cuma 3x. Sudah pasti murah?”"
                            : "“Sebulan naik 10%. Sesuai datanya?”"}
                      </h3>
                      <div className="explore-bottom">
                        <span>
                          {example.id === "dividend"
                            ? "Ada rata-rata yang menyembunyikan cerita."
                            : example.id === "valuation"
                              ? "Cek rasionya, bukan hanya narasinya."
                              : "Samakan periode, baru bandingkan."}
                        </span>
                        <span className="round-arrow">
                          <ArrowRight size={14} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
              <div className="how-strip">
                <div>
                  <span className="strip-icon">
                    <Fingerprint size={25} />
                  </span>
                  <span>
                    <b>Dari “katanya” jadi “ini faktanya”.</b>
                    <small>
                      Setiap klaim punya proses. Setiap hasil punya alasan.
                    </small>
                  </span>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("guide")}
                >
                  Intip cara kerjanya <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          {(page === "history" || page === "saved") && (
            <section className="collection-page">
              <div className="eyebrow hero-eyebrow">
                <span className="tiny-line" /> JEJAK RASA PENASARAN
              </div>
              <div className="collection-heading">
                <div>
                  <h1>
                    {page === "saved"
                      ? "Layak disimpan."
                      : "Sudah pernah dicek."}
                  </h1>
                  <p>
                    {page === "saved"
                      ? "Kumpulan rapor pilihanmu, siap dibaca lagi."
                      : "Kembali ke klaim, bukti, dan konteks yang kamu telusuri."}
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => navigate("check")}
                >
                  <Plus size={17} /> Cek klaim baru
                </button>
              </div>
              <div className="history-toolbar">
                <label className="search-field">
                  <Search size={18} />
                  <input
                    placeholder="Cari isi klaim..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label="Cari riwayat"
                  />
                </label>
                <label className="filter-field">
                  <span>Status</span>
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option>Semua</option>
                    <option>Didukung</option>
                    <option>Dibantah</option>
                    <option>Benar tapi menyesatkan</option>
                  </select>
                </label>
              </div>
              <div className="history-count">
                {filteredHistory.length} RAPOR{" "}
                {page === "saved" ? "TERSIMPAN" : "DI PERANGKAT INI"}
              </div>
              {filteredHistory.length ? (
                <div className="history-list">
                  {filteredHistory.map((item) => {
                    const example = examples.find(
                      (entry) => entry.id === item.demoId,
                    );
                    return (
                      <article className="history-item" key={item.id}>
                        <span className="history-item-icon">
                          <FileText size={22} />
                        </span>
                        <button
                          className="history-open"
                          onClick={() => openReport(item)}
                        >
                          <span className="history-item-meta">
                            {example?.ticker || "KLAIM BEBAS"}
                            <span>·</span>
                            {new Date(item.createdAt).toLocaleString("id-ID", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            <span>· DEMO</span>
                          </span>
                          <h3>{item.text}</h3>
                          <span
                            className={`verdict ${example?.tone || "neutral"}`}
                          >
                            <span className="status-dot" />
                            {example?.status || "Tidak bisa diverifikasi"}
                          </span>
                        </button>
                        <button
                          className="icon-button"
                          aria-label={
                            item.saved ? "Hapus dari tersimpan" : "Simpan rapor"
                          }
                          onClick={() => toggleSave(item)}
                        >
                          <Bookmark
                            size={19}
                            fill={item.saved ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Buka rapor"
                          onClick={() => openReport(item)}
                        >
                          <ArrowUpRight size={20} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    {page === "saved" ? (
                      <Bookmark size={30} />
                    ) : (
                      <History size={30} />
                    )}
                  </div>
                  <h2>
                    {query || filter !== "Semua"
                      ? "Belum ada yang cocok."
                      : page === "saved"
                        ? "Tempat untuk temuan berhargamu."
                        : "Rasa penasaran dimulai di sini."}
                  </h2>
                  <p>
                    {query || filter !== "Semua"
                      ? "Coba kata pencarian atau status lain."
                      : "Coba periksa satu contoh klaim. Rapor demo akan muncul di riwayat dan bisa kamu simpan."}
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => {
                      if (query || filter !== "Semua") {
                        setQuery("");
                        setFilter("Semua");
                      } else navigate("check");
                    }}
                  >
                    {query || filter !== "Semua"
                      ? "Reset pencarian"
                      : "Mulai cek klaim"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <p className="local-note">
                <ShieldCheck size={15} /> Riwayat disimpan di browser ini,
                maksimal 50 rapor terbaru.
              </p>
            </section>
          )}

          {page === "guide" && (
            <section className="guide-page">
              <div className="eyebrow hero-eyebrow">
                <span className="tiny-line" /> DI BALIK LAYAR
              </div>
              <h1>
                Bukan sekadar benar.
                <br />
                <span>Harus utuh ceritanya.</span>
              </h1>
              <p className="guide-intro">
                Informasi yang baik memberi kamu alasan untuk memahami, bukan
                tekanan untuk mengikuti.
              </p>
              <div className="guide-grid">
                {[
                  {
                    icon: MessageSquareQuote,
                    title: "Pisahkan klaim dari opini.",
                    text: "Teks diurai menjadi pernyataan yang bisa diperiksa. “PER 3x” adalah klaim angka. “Pasti cuan” adalah prediksi.",
                  },
                  {
                    icon: ChartNoAxesCombined,
                    title: "Periksa angka dengan bukti.",
                    text: "Pada produk terintegrasi, data Sectors menjadi pembanding. Perhitungan dilakukan oleh kode, dengan periode yang sesuai.",
                  },
                  {
                    icon: Layers3,
                    title: "Buru konteks yang hilang.",
                    text: "Context Hunter menelusuri kemungkinan pembayaran satu kali, basis pembanding rendah, atau periode yang dipilih-pilih.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Baca hasil, pahami alasannya.",
                    text: "Rapor menunjukkan status, data pembanding, dan konteksnya. Jika data tidak cukup, hasil menyatakannya secara terbuka.",
                  },
                ].map(({ icon: Icon, title, text }, index) => (
                  <article className="guide-card" key={title}>
                    <div>
                      <Icon size={25} />
                      <span>0{index + 1}</span>
                    </div>
                    <h2>{title}</h2>
                    <p>{text}</p>
                  </article>
                ))}
              </div>
              <div className="verdict-guide">
                <h2>Satu klaim, beberapa kemungkinan.</h2>
                <div>
                  {[
                    {
                      tone: "green",
                      title: "Didukung",
                      text: "Klaim sesuai dengan data pembanding.",
                    },
                    {
                      tone: "red",
                      title: "Dibantah",
                      text: "Klaim tidak sesuai dengan data pembanding.",
                    },
                    {
                      tone: "amber",
                      title: "Benar tapi menyesatkan",
                      text: "Angka sesuai, tetapi konteks penting hilang.",
                    },
                    {
                      tone: "neutral",
                      title: "Tidak bisa diverifikasi",
                      text: "Data belum cukup atau klaim terlalu kabur.",
                    },
                    {
                      tone: "neutral",
                      title: "Di luar cakupan",
                      text: "Prediksi atau opini, bukan klaim faktual.",
                    },
                  ].map((item) => (
                    <div key={item.title}>
                      <span className={`verdict ${item.tone}`}>
                        <span className="status-dot" />
                        {item.title}
                      </span>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <button
                className="primary-button"
                onClick={() => navigate("check")}
              >
                Oke, coba satu klaim <ArrowRight size={17} />
              </button>
            </section>
          )}

          {storageError && (
            <p className="storage-error" role="status">
              Browser tidak mengizinkan penyimpanan lokal. Riwayat hanya
              tersedia selama halaman ini terbuka.
            </p>
          )}
          <footer>
            <div>
              <span className="footer-brand">
                <CheckCheck size={17} /> cekdulu.
              </span>
              <span>Jernih melihat. Bijak menyikapi.</span>
            </div>
            <p>Alat informasi & analisis. Bukan nasihat investasi.</p>
            <button onClick={() => setModal("about")}>
              Built for Sectors Hackathon <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal === "about" && (
        <Modal
          title="Rasa penasaran yang sehat."
          onClose={() => setModal(null)}
        >
          <p>
            Cek Dulu membantu investor ritel memahami klaim saham melalui bukti
            dan konteks. Dibuat untuk Sectors Hackathon 2026.
          </p>
          <div className="modal-callout">
            <Sparkles size={22} />
            <div>
              <b>Kamu sedang menjelajahi frontend demo.</b>
              <p>
                Seluruh pemeriksaan memakai fixture lokal. Belum ada koneksi ke
                Sectors, LLM, akun pengguna, maupun backend. Riwayat hanya
                disimpan di browser kamu.
              </p>
            </div>
          </div>
          <p>
            Hasil ilustrasi bukan data pasar terkini dan bukan rekomendasi
            membeli atau menjual saham.
          </p>
        </Modal>
      )}
      {modal === "evidence" && activeFixture && (
        <Modal
          title="Buktinya harus bisa ditelusuri."
          onClose={() => setModal(null)}
        >
          <span className="small-tag">FIXTURE LOKAL · BUKAN DATA LIVE</span>
          <p>{activeFixture.evidence}.</p>
          <div className="evidence-table">
            {activeFixture.metrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <b>{metric.value}</b>
              </div>
            ))}
          </div>
          <p>{activeFixture.detail}</p>
          <p className="muted">
            Angka ini dipakai untuk mendemonstrasikan tampilan rapor. Verifikasi
            sumber dan tanggal data akan tersedia setelah integrasi backend.
          </p>
        </Modal>
      )}
    </div>
  );
}
