"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCircle2,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleHelp,
  Clock3,
  Database,
  Download,
  FileSearch,
  FileText,
  Fingerprint,
  History,
  Image as ImageIcon,
  Layers3,
  Link2,
  LoaderCircle,
  MinusCircle,
  Search,
  ShieldCheck,
  UploadCloud,
  Video,
  Waypoints,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  examples,
  type DemoId,
} from "./demo";
import { InputAdaptationSchema, type CheckResult, type CheckSource, type InputAdaptation, type TraceEvent, type Verdict } from "../../packages/shared/src/schemas";
import { readCheckStream } from "../../apps/web/lib/check-stream";
import { HistoryItemSchema, formatEvidence, readHistory, storageKey, type HistoryItem } from "../../apps/web/lib/check-view";
import { readTickerChoices, type UiTickerChoice } from "../../apps/web/lib/ticker-choices";
import { downloadReportPdf } from "../../apps/web/lib/report-pdf";
import { comparisonFor } from "../../apps/web/lib/report-presentation";
import { checkOutcome, traceDetails } from '../../apps/web/lib/check-outcome';
import { cleanText } from "../../packages/agent/src/clean-text";

type Page = "landing" | "check" | "history" | "saved";
type Phase = "idle" | "analyzing" | "result";
type InputMode = "text" | "screenshot" | "link" | "video";
type LandingView = "home" | "product" | "how" | "data";

type UiFixture = {
  ticker: string; category: string; status: string; shortStatus: string; tone: string;
  headline: string; summary: string; claimed: string; verified: string; delta: string;
  context: string; detail: string; evidenceCount: number; duration: string;
  contextPoints?: readonly string[];
  evidence: readonly { label: string; value: string; flag: string }[];
  hypotheses: readonly { code: string; status: string }[]; source: string;
};
type DemoFixture = UiFixture & { quote?: string };

const verdictPresentation: Record<Verdict, Pick<UiFixture, "status" | "shortStatus" | "tone" | "headline">> = {
  supported: { status: "Didukung", shortStatus: "SUPPORTED", tone: "lime", headline: "Klaim ini sesuai dengan data pembanding." },
  refuted: { status: "Dibantah", shortStatus: "REFUTED", tone: "red", headline: "Angka dalam klaim tidak cocok dengan pembanding." },
  misleading: { status: "Benar, tapi menyesatkan", shortStatus: "MISLEADING", tone: "amber", headline: "Angkanya cocok. Konteksnya mengubah cerita." },
  unverifiable: { status: "Tidak bisa diverifikasi", shortStatus: "UNVERIFIABLE", tone: "violet", headline: "Data yang tersedia belum cukup untuk memeriksa klaim ini." },
  out_of_scope: { status: "Di luar cakupan", shortStatus: "OUT OF SCOPE", tone: "neutral", headline: "Pernyataan ini berupa prediksi atau opini, bukan klaim faktual." },
};

/** Satu verdict ke tampilan. Angka memakai comparisonFor: persen klaim (25,5) dan evidence (0,255) diselaraskan. */
function resultFixture(result: CheckResult, index = 0, text = ""): DemoFixture | undefined {
  const verdict = result.verdicts[index] ?? result.verdicts[0];
  if (!verdict) return undefined;
  const claim = result.claims.find(item => item.claimId === verdict.claimId);
  const evidence = result.evidence.filter(item => verdict.evidenceIds.includes(item.evidenceId));
  const presentation = verdictPresentation[verdict.verdict]!;
  const comparison = comparisonFor(claim, verdict);
  const quote = claim && text ? cleanText(text).slice(claim.span[0], claim.span[1]) : "";
  return {
    ticker: claim?.ticker ?? "—", category: claim?.type.replaceAll("_", " ").toUpperCase() ?? "UNRESOLVED",
    ...presentation, summary: verdict.explanation, claimed: claim?.asserted.value === undefined ? "—" : comparison.left,
    verified: verdict.computed ? comparison.right : "—", delta: "—", ...(quote ? { quote } : {}),
    context: verdict.missingContext[0]?.summary ?? "Tidak ada konteks tambahan yang terpicu.",
    contextPoints: verdict.missingContext.map(item => item.summary),
    detail: verdict.explanation, evidenceCount: evidence.length, duration: `${result.creditsUsed} kredit`,
    evidence: evidence.map(item => ({ label: item.label, value: formatEvidence(item), flag: item.cached ? "CACHE" : "EVIDENCE" })),
    hypotheses: verdict.missingContext.map(item => ({ code: item.hypId, status: "TRIGGERED" })),
    source: [...new Set(evidence.map(item => item.tool))].join(" · ") || "EVIDENCE BACKEND",
  };
}

const investigationSteps = [
  {
    id: "normalize",
    title: "Normalize input",
    subtitle: "Membaca ticker dan struktur kalimat",
    meta: "ENTITY RESOLUTION",
  },
  {
    id: "extract",
    title: "Extract claim",
    subtitle: "Memisahkan klaim yang bisa diverifikasi",
    meta: "CLAIM PARSER",
  },
  {
    id: "evidence",
    title: "Fetch evidence",
    subtitle: "Menyiapkan angka pembanding pada fixture",
    meta: "EVIDENCE LAYER",
  },
  {
    id: "context",
    title: "Context Hunter",
    subtitle: "Menguji konteks yang bisa mengubah makna",
    meta: "HYPOTHESIS RUN",
  },
  {
    id: "adjudicate",
    title: "Adjudicate",
    subtitle: "Menyusun status berdasarkan evidence",
    meta: "VERDICT ENGINE",
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <CheckCheck size={compact ? 19 : 22} strokeWidth={2.6} />
      </span>
      <span className="brand-word">
        cek<span>dulu</span><i>.</i>
      </span>
    </span>
  );
}

function VerdictIcon({ tone, size = 18 }: { tone: string; size?: number }) {
  if (tone === "lime") return <CheckCircle2 size={size} />;
  if (tone === "red") return <XCircle size={size} />;
  if (tone === "amber") return <AlertTriangle size={size} />;
  if (tone === "violet") return <CircleHelp size={size} />;
  return <MinusCircle size={size} />;
}

function VerificationCore({ small = false }: { small?: boolean }) {
  return (
    <div className={`verification-core ${small ? "verification-core-small" : ""}`} aria-hidden="true">
      <div className="core-orbit orbit-a" />
      <div className="core-orbit orbit-b" />
      <div className="core-orbit orbit-c" />
      <div className="core-cross core-cross-x" />
      <div className="core-cross core-cross-y" />
      <div className="core-center">
        <Fingerprint size={small ? 20 : 28} />
      </div>
      <span className="core-tick tick-a" />
      <span className="core-tick tick-b" />
      <span className="core-tick tick-c" />
      <span className="core-tick tick-d" />
    </div>
  );
}

function LandingMachine() {
  return (
    <div className="machine" aria-hidden="true">
      <svg className="machine-paths" viewBox="0 0 620 540" fill="none">
        <defs>
          <linearGradient id="pathGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#37D7FF" />
            <stop offset="0.58" stopColor="#5B78FF" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d="M62 122C170 84 193 183 286 208C361 228 405 215 490 159" className="path-neutral" />
        <path d="M60 390C177 412 206 350 292 316C382 280 425 331 559 299" className="path-neutral" />
        <path d="M128 476C228 410 255 403 322 347C385 294 432 251 531 227" className="path-neutral" />
        <path d="M170 74C259 127 264 187 312 251C363 318 429 390 542 417" className="path-neutral" />
        <path d="M62 122C170 84 193 183 286 208C361 228 405 215 490 159" className="path-active" filter="url(#softGlow)" />
        <circle cx="62" cy="122" r="5" className="machine-dot dot-one" />
        <circle cx="490" cy="159" r="5" className="machine-dot dot-two" />
        <circle cx="559" cy="299" r="5" className="machine-dot dot-three" />
        <circle cx="542" cy="417" r="5" className="machine-dot dot-four" />
      </svg>

      <div className="machine-glow" />
      <div className="machine-core-wrap">
        <VerificationCore />
        <div className="core-caption">
          <span>CONTEXT ENGINE</span>
          <b>VERIFYING</b>
        </div>
      </div>

      <div className="machine-card machine-claim">
        <div className="machine-label">SOCIAL CLAIM</div>
        <strong>“ADRO yield 25,5% setahun”</strong>
        <span className="machine-tag">$ADRO · DIVIDEND</span>
      </div>

      <div className="machine-card machine-data">
        <div className="machine-label">SECTORS / DIVIDEND</div>
        <span>TTM YIELD</span>
        <strong>5.56%</strong>
        <small>Evidence available</small>
      </div>

      <div className="machine-card machine-context">
        <div className="machine-label">CONTEXT FOUND</div>
        <Layers3 size={17} />
        <strong>One-off payment</strong>
        <span>historical average distorted</span>
      </div>

      <div className="machine-verdict">
        <AlertTriangle size={18} />
        <span>
          BENAR, TAPI
          <b>MENYESATKAN</b>
        </span>
      </div>

      <span className="machine-coordinate coordinate-a">NODE / 04</span>
      <span className="machine-coordinate coordinate-b">TRACE 12.4S</span>
      <span className="machine-coordinate coordinate-c">EVIDENCE 04</span>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="product-stage">
      <div className="dot-field" />
      <div className="preview-frame">
        <div className="preview-metal-top">
          <span /><span /><span />
          <div className="preview-url">app.cekdulu.id/check/CD-240930-1842</div>
          <div className="preview-top-status"><span /> LIVE TRACE</div>
        </div>
        <div className="preview-app">
          <aside className="preview-sidebar">
            <Brand compact />
            <div className="preview-nav active"><Search size={14} /> Check</div>
            <div className="preview-nav"><History size={14} /> History</div>
            <div className="preview-nav"><Bookmark size={14} /> Saved</div>
            <div className="preview-sidebar-glow" />
          </aside>
          <div className="preview-workspace">
            <div className="preview-kicker">CHECK #CD-240930-1842 / ADRO · DIVIDEND</div>
            <div className="preview-row">
              <div className="preview-verdict-panel">
                <div className="preview-badge"><AlertTriangle size={14} /> MISLEADING</div>
                <h3>Benar secara angka.<br />Konteksnya berbeda.</h3>
                <div className="preview-metrics">
                  <div><span>CLAIMED</span><b>25.5%</b></div>
                  <ArrowRight size={18} />
                  <div><span>VERIFIED / TTM</span><b>5.56%</b></div>
                </div>
              </div>
              <div className="preview-trace">
                <div className="preview-trace-title"><Activity size={14} /> LIVE INVESTIGATION</div>
                {investigationSteps.slice(0, 4).map((item, index) => (
                  <div className="preview-trace-row" key={item.id}>
                    <span className={index === 3 ? "active" : "done"}>{index === 3 ? "" : "✓"}</span>
                    <div><b>{item.title}</b><small>{item.meta}</small></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="preview-evidence-grid">
              <div><span>YIELD 5Y AVG</span><b>25.50%</b><em>MATCH</em></div>
              <div><span>YIELD TTM</span><b>5.56%</b><em>GAP</em></div>
              <div><span>SPECIAL DIVIDEND</span><b>1,358.18</b><em>OUTLIER</em></div>
              <div><span>CONTEXT</span><b>1 OFF</b><em>TRIGGERED</em></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-topline">
        <span>CEK DULU / INSPECTOR</span>
        <button className="icon-button" onClick={onClose} aria-label="Tutup dialog">
          <X size={18} />
        </button>
      </div>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}

function LegalStrip() {
  return (
    <div className="legal-strip">
      <ShieldCheck size={14} />
      <span>
        Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi. Status klaim menilai kesesuaian klaim dengan data yang tersedia, bukan kelayakan membeli atau menjual saham. Data bersumber dari Sectors dan dapat tertinggal dari kondisi terkini. Lakukan riset sendiri sebelum mengambil keputusan.
      </span>
    </div>
  );
}

function LandingDetailPage({ view, enterWorkspace }: { view: Exclude<LandingView, "home">; enterWorkspace: () => void }) {
  const content = {
    product: {
      index: "02 / PRODUCT",
      eyebrow: "CLAIM INTELLIGENCE WORKSPACE",
      title: "Satu ruang untuk membedah klaim sampai ke konteksnya.",
      copy: "Lihat teks sumber, angka pembanding, konteks yang hilang, dan verdict dalam satu alur pemeriksaan.",
    },
    how: {
      index: "03 / HOW IT WORKS",
      eyebrow: "TRACEABLE PROCESS",
      title: "Setiap hasil punya jejak yang bisa diikuti.",
      copy: "Proses pemeriksaan bergerak dari klaim mentah menuju evidence, konteks, lalu verdict berbasis aturan.",
    },
    data: {
      index: "04 / DATA",
      eyebrow: "EVIDENCE LAYER",
      title: "Angka tidak tampil tanpa dasar yang jelas.",
      copy: "Setiap nilai pada report dikaitkan dengan evidence dan sumber modul yang digunakan dalam pemeriksaan.",
    },
  }[view];

  const modules = view === "how" ? [
    ["01", "INPUT", "Tangkap klaim", "Teks, screenshot, atau video diubah menjadi klaim yang dapat diperiksa."],
    ["02", "VERIFY", "Bandingkan angka", "Nilai klaim dicocokkan dengan evidence yang tersedia."],
    ["03", "CONTEXT", "Cari yang hilang", "Context Hunter menguji detail yang dapat mengubah makna angka."],
    ["04", "VERDICT", "Susun report", "Status dan penjelasan dibangun dari hasil pemeriksaan."],
  ] : [
    ["01", "TRACEABLE", "Evidence terhubung", "Angka pembanding tetap dapat dilacak ke modul sumbernya."],
    ["02", "GROUNDED", "Tidak ada angka liar", "Penjelasan hanya memakai nilai yang tersedia pada evidence."],
    ["03", "CONTEXT", "Makna ikut diperiksa", "Angka benar belum tentu menceritakan keadaan secara utuh."],
  ];

  return (
    <main key={view} className="landing-detail landing-detail-transition">
      <section className="landing-detail-hero">
        <div className="detail-index">{content.index}</div>
        <div className="detail-copy">
          <span className="eyebrow"><span className="pulse-dot" /> {content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.copy}</p>
          <button onClick={enterWorkspace}>Buka workspace <ArrowRight size={17} /></button>
        </div>
        <div className="detail-orbit" aria-hidden="true"><VerificationCore /><b>0{view === "product" ? 2 : view === "how" ? 3 : 4}</b></div>
      </section>

      {view === "product" ? (
        <section className="detail-product"><ProductPreview /></section>
      ) : (
        <section className={`detail-modules detail-modules-${view}`}>
          {modules.map(([number, tag, title, copy], index) => (
            <article key={number} style={{ "--module-index": index } as CSSProperties}>
              <span>{number} / {tag}</span>
              <div>{index === 0 ? <FileSearch size={20} /> : index === 1 ? <Database size={20} /> : index === 2 ? <Layers3 size={20} /> : <ShieldCheck size={20} />}</div>
              <h2>{title}</h2><p>{copy}</p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function LandingPage({
  input,
  setInput,
  chooseExample,
  enterWorkspace,
  initialView,
}: {
  input: string;
  setInput: (value: string) => void;
  chooseExample: (id: DemoId) => void;
  enterWorkspace: (run?: boolean) => void;
  initialView: LandingView;
}) {
  const howRef = useRef<HTMLElement>(null);
  const landingRef = useRef<HTMLDivElement>(null);
  const [landingView, setLandingView] = useState<LandingView>(initialView);

  useEffect(() => {
    const root = landingRef.current;
    if (!root) return;

    const sections = root.querySelectorAll<HTMLElement>(".landing-reveal, .landing-scroll-scene");
    if (!("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-visible", entry.isIntersecting);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [landingView]);

  return (
    <div ref={landingRef} className="landing-page dashboard-view-transition landing-enter">
      <div className="landing-ambient ambient-one" />
      <div className="landing-ambient ambient-two" />
      <header className="landing-nav landing-intro-nav">
        <button className="landing-logo" onClick={() => { setLandingView("home"); window.scrollTo({ top: 0 }); }}>
          <Brand />
        </button>
        <nav>
          <button className={landingView === "product" ? "active" : ""} onClick={() => { setLandingView("product"); window.scrollTo({ top: 0 }); }}>Produk</button>
          <button className={landingView === "how" ? "active" : ""} onClick={() => { setLandingView("how"); window.scrollTo({ top: 0 }); }}>Cara kerja</button>
          <button className={landingView === "data" ? "active" : ""} onClick={() => { setLandingView("data"); window.scrollTo({ top: 0 }); }}>Data</button>
        </nav>
        <div className="landing-nav-actions">
          <button className="nav-login" onClick={() => enterWorkspace(false)}>Masuk</button>
          <a className="nav-cta" href="/check" onClick={(event) => { event.preventDefault(); enterWorkspace(false); }}>
            Periksa klaim <ArrowUpRight size={15} />
          </a>
        </div>
      </header>

      <main key={landingView} className="landing-page-view-transition">
        {landingView === "home" && <section className="landing-hero landing-scroll-scene">
          <div className="hero-grid-overlay" />
          <svg className="hero-cable hero-cable-a" viewBox="0 0 700 420" fill="none" aria-hidden="true">
            <path d="M0 318C180 220 272 404 407 247C504 135 573 152 700 39" />
          </svg>
          <svg className="hero-cable hero-cable-b" viewBox="0 0 700 420" fill="none" aria-hidden="true">
            <path d="M34 49C190 102 223 16 359 111C486 199 534 314 700 345" />
          </svg>

          <div className="landing-copy landing-intro-copy">
            <div className="eyebrow"><span className="pulse-dot" /> AI CLAIM VERIFICATION / SECTORS DATA</div>
            <h1>
              Klaim saham. Sebelum ikut hype,
              <span>cek dulu angkanya.</span>
            </h1>
            <p>
              Pecah klaim saham menjadi evidence, konteks, dan verdict yang bisa diperiksa — tanpa memberi rekomendasi transaksi.
            </p>

            <form
              className="hero-input-dock"
              onSubmit={(event) => {
                event.preventDefault();
                enterWorkspace(true);
              }}
            >
              <Search size={18} />
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Tempel klaim saham..."
                aria-label="Klaim saham"
              />
              <button type="submit" disabled={!input.trim()}>
                Periksa <ArrowRight size={17} />
              </button>
            </form>
          </div>

          <div className="landing-visual landing-intro-visual">
            <LandingMachine />
          </div>

          <div className="hero-bottom-readout landing-intro-readout">
            <span>CLAIM → EVIDENCE → CONTEXT → VERDICT</span>
            <span>01 / SIGNAL INTELLIGENCE</span>
          </div>
        </section>}

        {landingView === "product" && <section className="product-showcase landing-reveal">
          <div className="showcase-heading">
            <div>
              <span className="section-number">02 / PRODUCT SURFACE</span>
              <h2>Satu ruang untuk membedah klaim, bukan menambah noise.</h2>
            </div>
            <p>Dense seperti instrument panel, tetapi hierarchy tetap berpusat pada apa yang diklaim, apa yang ditemukan, dan konteks yang hilang.</p>
          </div>
          <ProductPreview />
        </section>}

        {landingView === "how" && <section className="how-section landing-reveal" ref={howRef}>
          <div className="how-heading">
            <div>
              <span className="section-number">03 / HOW IT WORKS</span>
              <h2>Empat tahap. Satu jejak yang bisa diikuti.</h2>
            </div>
            <p>Setiap klaim bergerak lewat alur yang transparan—dari teks mentah sampai verdict yang punya dasar.</p>
          </div>
          <div className="pipeline">
            {[
              ["01", "INPUT", "Tempel klaim", "Teks sumber tetap terlihat sepanjang proses."],
              ["02", "VERIFY", "Cari evidence", "Angka klaim dibandingkan dengan data yang tersedia."],
              ["03", "CONTEXT", "Uji konteks", "Context Hunter mencari cerita yang hilang di balik angka."],
              ["04", "VERDICT", "Susun rapor", "Status, pembanding, konteks, dan sumber tampil dalam satu layar."],
            ].map(([number, tag, title, copy], index) => (
              <div className="pipeline-node" key={number}>
                <div className="pipeline-node-top">
                  <span>{number}</span>
                  <i>{tag}</i>
                </div>
                <div className="pipeline-icon">
                  {index === 0 ? <Search size={20} /> : index === 1 ? <Database size={20} /> : index === 2 ? <Layers3 size={20} /> : <ShieldCheck size={20} />}
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
                <div className="pipeline-signal" aria-hidden="true">
                  <span /><span /><span /><span /><span />
                  <b>{index === 0 ? "CAPTURE" : index === 1 ? "MATCH" : index === 2 ? "HUNT" : "REPORT"}</b>
                </div>
                {index < 3 && <div className="pipeline-connector"><span /></div>}
              </div>
            ))}
          </div>
        </section>}

        {landingView === "data" && <section className="landing-data-page landing-reveal" aria-label="Data dan evidence">
          <div className="data-page-heading">
            <div>
              <span className="section-number">04 / DATA &amp; EVIDENCE</span>
              <h2>Data yang dipakai untuk memeriksa klaim.</h2>
            </div>
            <p>Cek Dulu mengubah data menjadi evidence yang dapat ditelusuri. Setiap angka pada report harus terkait dengan sumber dan konteks pemeriksaannya.</p>
          </div>

          <div className="data-source-grid">
            {[
              ["01", "VALUATION", "Laporan perusahaan", "Metrik valuasi seperti PER dan PBV untuk membandingkan angka dalam klaim.", "Company report"],
              ["02", "DIVIDEND", "Riwayat dividen", "Yield, pembayaran, dan konteks historis untuk membedakan pola rutin dari kejadian khusus.", "Dividend data"],
              ["03", "PRICE MOVE", "Harga dan volume", "Data transaksi harian untuk menghitung perubahan harga pada jendela yang disebutkan.", "Daily transaction"],
            ].map(([number, tag, title, copy, source], index) => (
              <article key={number} style={{ "--data-index": index } as CSSProperties}>
                <div className="data-card-top"><span>{number}</span><i>{tag}</i></div>
                <div className="data-card-icon">{index === 0 ? <Activity size={21} /> : index === 1 ? <Database size={21} /> : <Waypoints size={21} />}</div>
                <h3>{title}</h3>
                <p>{copy}</p>
                <footer><span>SECTORS MODULE</span><b>{source}</b></footer>
              </article>
            ))}
          </div>

          <div className="data-grounding-panel">
            <div><ShieldCheck size={22} /><span>GROUNDING RULE</span></div>
            <h3>Tidak ada angka tanpa evidence.</h3>
            <p>Penjelasan hanya boleh memakai angka yang tersedia pada evidence. Status klaim ditentukan oleh aturan pemeriksaan, bukan opini model.</p>
            <aside><span>STATUS DATA</span><b><i /> FRONTEND DEMO / FIXTURE LOKAL</b><small>Belum memakai data pasar live atau request backend.</small></aside>
          </div>
        </section>}

        {landingView !== "home" && <section className="landing-final-cta landing-reveal">
          <div className="final-cta-grid" />
          <div className="final-cta-visual" aria-hidden="true">
            <span className="cta-ring cta-ring-a" />
            <span className="cta-ring cta-ring-b" />
            <span className="cta-ring cta-ring-c" />
            <span className="cta-scan" />
            <span className="cta-core"><Fingerprint size={23} /></span>
            <b>04</b>
          </div>
          <div className="final-cta-copy">
            <span className="eyebrow"><span className="pulse-dot" /> READY FOR A NEW CHECK</span>
            <h2>Ada klaim saham yang bikin ragu?</h2>
            <p>Periksa datanya sebelum ikut narasi.</p>
            <div className="final-cta-tags" aria-label="Hasil pemeriksaan">
              <span>CLAIM</span><i />
              <span>EVIDENCE</span><i />
              <span>CONTEXT</span><i />
              <span>VERDICT</span>
            </div>
            <div className="final-cta-readout">
              <span><i /> DATA TRACEABLE</span>
              <span><i /> CONTEXT CHECKED</span>
              <span><i /> VERDICT READY</span>
            </div>
          </div>
          <div className="final-cta-action">
            <small>01 / MULAI PEMERIKSAAN</small>
            <button onClick={() => enterWorkspace(false)}>
              Buka workspace <ArrowRight size={18} />
            </button>
            <em>Tanpa rekomendasi transaksi</em>
          </div>
        </section>}
      </main>
      <LegalStrip />
    </div>
  );
}

function AppSidebar({
  page,
  setPage,
  historyCount,
  savedCount,
  goLanding,
}: {
  page: Page;
  setPage: (page: Page) => void;
  historyCount: number;
  savedCount: number;
  goLanding: (view?: LandingView) => void;
}) {
  return (
    <aside className="app-sidebar">
      <button className="sidebar-logo" onClick={() => goLanding()}><Brand compact /></button>
      <div className="sidebar-subbrand">CLAIM INTELLIGENCE</div>
      <nav className="sidebar-nav" aria-label="Workspace">
        <button className={page === "check" ? "active" : ""} onClick={() => setPage("check")}>
          <Search size={17} /><span>Cek klaim</span><i>01</i>
        </button>
        <button className={page === "history" ? "active" : ""} onClick={() => setPage("history")}>
          <History size={17} /><span>Riwayat</span><i>{String(historyCount).padStart(2, "0")}</i>
        </button>
        <button className={page === "saved" ? "active" : ""} onClick={() => setPage("saved")}>
          <Bookmark size={17} /><span>Tersimpan</span><i>{String(savedCount).padStart(2, "0")}</i>
        </button>
      </nav>
      <div className="sidebar-separator" />
      <button className="sidebar-help" onClick={() => goLanding("how")}>
        <CircleHelp size={17} /><span>Cara kerja</span><ArrowUpRight size={14} />
      </button>
    </aside>
  );
}

function AppTopbar({ phase }: { phase: Phase }) {
  return (
    <header className="app-topbar">
      <div className="instrument-breadcrumb">
        <span>CEK DULU</span><i>/</i><span>CHECK</span><i>/</i><b>{phase === "idle" ? "NEW ANALYSIS" : phase === "analyzing" ? "LIVE INVESTIGATION" : "REPORT"}</b>
      </div>
    </header>
  );
}

function IntelligencePreview({ chooseExample }: { chooseExample: (id: DemoId) => void }) {
  const fixture = examples[0];
  return (
    <aside className="intel-preview">
      <div className="intel-grid" />
      <div className="intel-top">
        <div>
          <span className="panel-kicker">CASE PREVIEW</span>
          <strong>{fixture.ticker} / {fixture.category}</strong>
        </div>
        <div className="mini-core-wrap"><VerificationCore small /></div>
      </div>
      <blockquote>“Yield 25,5% setahun”</blockquote>
      <div className="preview-verdict-chip amber"><AlertTriangle size={14} /> BENAR, TAPI MENYESATKAN</div>
      <div className="intel-metric-flow">
        <div><span>CLAIMED</span><b>25.5%</b></div>
        <div className="metric-path"><span /></div>
        <div><span>VERIFIED / TTM</span><b>5.56%</b></div>
      </div>
      <div className="intel-context">
        <Layers3 size={17} />
        <div><span>CONTEXT DETECTED</span><p>One-off payment dominates the historical average.</p></div>
      </div>
      <div className="intel-source-row">
        <span><Database size={13} /> SECTORS FIXTURE</span>
        <span>04 EVIDENCE</span>
      </div>
      <button className="text-link" onClick={() => chooseExample("dividend")}>Gunakan contoh ini <ArrowRight size={15} /></button>
    </aside>
  );
}

function IdleCheck({
  input,
  setInput,
  running,
  chooseExample,
  startCheck,
  onPrepared,
}: {
  input: string;
  setInput: (value: string) => void;
  running: boolean;
  chooseExample: (id: DemoId) => void;
  startCheck: () => void;
  onPrepared: (input: InputAdaptation) => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<InputMode>("text");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [reading, setReading] = useState(false);
  const [mediaMessage, setMediaMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mediaFile) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(mediaFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mediaFile]);

  useEffect(() => () => {
    if (readTimer.current) clearTimeout(readTimer.current);
  }, []);

  const modes: { id: InputMode; label: string; meta: string; icon: typeof FileText }[] = [
    { id: "text", label: "Teks", meta: "PASTE", icon: FileText },
    { id: "screenshot", label: "Screenshot", meta: "IMAGE", icon: ImageIcon },
    { id: "link", label: "Link video", meta: "URL", icon: Link2 },
    { id: "video", label: "Unggah video", meta: "FILE", icon: Video },
  ];

  function changeMode(next: InputMode) {
    if (reading || next === mode) return;
    setMode(next);
    setInput("");
    setMediaFile(null);
    setVideoUrl("");
    setMediaMessage("");
  }

  async function prepareMedia() {
    if (reading) return;
    if (mode === "link" && !videoUrl.trim()) return;
    if ((mode === "screenshot" || mode === "video") && !mediaFile) return;
    setReading(true);
    setMediaMessage("");
    try {
      let body: FormData | string;
      if (mode === "link") body = JSON.stringify({ url: videoUrl.trim() });
      else {
        if (!mediaFile) throw new Error("Pilih berkas terlebih dahulu.");
        body = new FormData(); body.set(mode === "screenshot" ? "image" : "video", mediaFile);
      }
      const response = await fetch("/api/input", { method: "POST", body,
        ...(typeof body === "string" ? { headers: { "Content-Type": "application/json" } } : {}) });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Input belum dapat dibaca.");
      const prepared = InputAdaptationSchema.parse(payload);
      setInput(prepared.rawText); onPrepared(prepared);
      setMediaMessage(prepared.warnings.join(" ") || "Pembacaan selesai. Tinjau teks sebelum memulai cek.");
    } catch (cause) { setMediaMessage(cause instanceof Error ? cause.message : "Input belum dapat dibaca."); }
    finally { setReading(false); }
  }

  const mediaReady = mode === "link" ? Boolean(videoUrl.trim()) : Boolean(mediaFile);

  return (
    <div className="workspace-page check-idle">
      <div className="page-title-row">
        <div>
          <span className="page-index">01 / NEW CHECK</span>
          <h1>Periksa klaim saham</h1>
          <p>Tempel teks, baca screenshot, atau siapkan konten video untuk diperiksa.</p>
        </div>
        <div className="page-readout"><Fingerprint size={15} /> INPUT → CLAIM → EVIDENCE → CONTEXT → VERDICT</div>
      </div>

      <div className="check-grid">
        <section className="input-chamber">
          <div className="chamber-topstrip">
            <span>CLAIM INPUT / MULTI-SOURCE</span>
            <span className="ready-indicator"><i /> BACKEND CONNECTED</span>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              startCheck();
            }}
          >
            <div className="input-mode-tabs" role="tablist" aria-label="Sumber input klaim">
              {modes.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={mode === item.id}
                    className={`input-mode-tab ${mode === item.id ? "active" : ""}`}
                    onClick={() => changeMode(item.id)}
                    disabled={running || reading}
                  >
                    <Icon size={17} />
                    <span><b>{item.label}</b><small>{item.meta}</small></span>
                  </button>
                );
              })}
            </div>

            {mode === "text" && (
              <div className="textarea-surface source-panel">
                <div className="scan-line" />
                <label htmlFor="claim-input">KLAIM SAHAM / RAW TEXT</label>
                <textarea
                  id="claim-input"
                  ref={inputRef}
                  value={input}
                  maxLength={5000}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={'Tempel klaim saham di sini…\ncontoh: “ADRO yield dividennya 25% setahun.”'}
                  disabled={running}
                />
                <div className="textarea-coordinates"><span>INPUT / RAW TEXT</span><span>UTF-8</span></div>
              </div>
            )}

            {mode === "screenshot" && (
              <div className="media-surface source-panel">
                <div className="media-surface-head"><span>SCREENSHOT READER</span><small>PNG · JPEG · WEBP / MAX 3 MB</small></div>
                <label className={`drop-zone ${mediaFile ? "has-file" : ""}`} htmlFor="claim-screenshot">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Pratinjau screenshot" />
                  ) : (
                    <div className="drop-zone-empty"><ImageIcon size={28} /><b>Tarik screenshot ke sini</b><span>atau pilih file dari perangkat</span></div>
                  )}
                  <input
                    id="claim-screenshot"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setMediaFile(file);
                      setInput("");
                      setMediaMessage("");
                    }}
                  />
                  {mediaFile && <div className="file-readout"><span>{mediaFile.name}</span><b>{(mediaFile.size / 1024 / 1024).toFixed(2)} MB</b></div>}
                </label>
                <div className="media-action-row">
                  <span><FileSearch size={14} /> Hasil OCR backend ditampilkan sebagai teks yang bisa diedit.</span>
                  <button type="button" onClick={() => void prepareMedia()} disabled={!mediaReady || reading}>{reading ? "MEMBACA…" : input ? "BACA ULANG" : "BACA TEKS SCREENSHOT"}</button>
                </div>
              </div>
            )}

            {mode === "link" && (
              <div className="media-surface source-panel link-source-panel">
                <div className="media-surface-head"><span>PUBLIC VIDEO LINK</span><small>HTTPS / PUBLIC URL</small></div>
                <div className="video-link-field">
                  <Link2 size={18} />
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(event) => {
                      setVideoUrl(event.target.value);
                      setInput("");
                      setMediaMessage("");
                    }}
                    placeholder="https://www.tiktok.com/... atau https://www.youtube.com/..."
                    aria-label="Tautan video publik"
                  />
                  <span>URL</span>
                </div>
                <div className="link-visualizer" aria-hidden="true">
                  <div className="link-node"><Video size={19} /><span>VIDEO</span></div>
                  <span className="link-wire"><i /></span>
                  <div className="link-node"><FileText size={19} /><span>TRANSCRIPT</span></div>
                  <span className="link-wire"><i /></span>
                  <div className="link-node accent"><Fingerprint size={19} /><span>CLAIMS</span></div>
                </div>
                <div className="media-action-row">
                  <span><FileSearch size={14} /> Audio dan tulisan video dibaca server lalu ditinjau sebagai teks.</span>
                  <button type="button" onClick={() => void prepareMedia()} disabled={!mediaReady || reading}>{reading ? "MEMBACA…" : input ? "BACA ULANG" : "BACA ISI VIDEO"}</button>
                </div>
              </div>
            )}

            {mode === "video" && (
              <div className="media-surface source-panel">
                <div className="media-surface-head"><span>VIDEO UPLOAD</span><small>MP4 · WEBM / MAX 4 MB</small></div>
                <label className={`drop-zone video-drop-zone ${mediaFile ? "has-file" : ""}`} htmlFor="claim-video">
                  {previewUrl && mediaFile ? (
                    <video src={previewUrl} muted controls={false} preload="metadata" />
                  ) : (
                    <div className="drop-zone-empty"><UploadCloud size={29} /><b>Unggah video pendek</b><span>MP4 atau WebM untuk dibaca sebelum pemeriksaan</span></div>
                  )}
                  <input
                    id="claim-video"
                    type="file"
                    accept="video/mp4,video/webm"
                    aria-label="Unggah video dari perangkat"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setMediaFile(file);
                      setInput("");
                      setMediaMessage("");
                    }}
                  />
                  {mediaFile && <div className="file-readout"><span>{mediaFile.name}</span><b>{(mediaFile.size / 1024 / 1024).toFixed(2)} MB</b></div>}
                </label>
                <div className="media-action-row">
                  <span><FileSearch size={14} /> Berkas diproses sementara dan tidak disimpan dalam riwayat.</span>
                  <button type="button" onClick={() => void prepareMedia()} disabled={!mediaReady || reading}>{reading ? "MEMBACA…" : input ? "BACA ULANG" : "BACA ISI VIDEO"}</button>
                </div>
              </div>
            )}

            {mode !== "text" && input && (
              <div className="prepared-text-panel">
                <div className="prepared-text-head"><span>TEKS HASIL PEMBACAAN / EDITABLE</span><span><CheckCircle2 size={13} /> READY</span></div>
                <textarea value={input} maxLength={5000} onChange={(event) => setInput(event.target.value)} aria-label="Teks klaim saham" />
                <div className="prepared-status"><span>{mediaMessage}</span><small>HASIL BACKEND · TINJAU SEBELUM CEK</small></div>
              </div>
            )}

            <div className="chamber-tools">
              <div className="example-tools">
                <span>CONTOH</span>
                {examples.map((example) => (
                  <button type="button" key={example.id} onClick={() => { changeMode("text"); chooseExample(example.id); }}>
                    <b>{example.ticker}</b> / {example.category.split(" ")[0]}
                  </button>
                ))}
              </div>
              <span className="char-count">{input.length.toLocaleString("id-ID")} / 5.000</span>
            </div>

            <div className="chamber-dock">
              <button type="submit" className="primary-action" disabled={!input.trim() || running || reading}>
                Periksa klaim <ArrowRight size={17} />
              </button>
            </div>
          </form>
        </section>
        <IntelligencePreview chooseExample={(id) => { changeMode("text"); chooseExample(id); }} />
      </div>

    </div>
  );
}

function AnalyzingView({
  input,
  activeStep,
  fixture,
  traces,
}: {
  input: string;
  activeStep: number;
  fixture: DemoFixture | undefined;
  traces: TraceEvent[];
}) {
  return (
    <div className="workspace-page analyzing-view">
      <div className="analysis-source-bar">
        <div><span>SOURCE CLAIM</span><p>“{input}”</p></div>
        <div className="source-meta"><span>{fixture?.ticker || "UNRESOLVED"}</span><span>{fixture?.category || "CUSTOM CLAIM"}</span></div>
      </div>

      <div className="analysis-heading-row">
        <div>
          <span className="page-index">LIVE / INVESTIGATION</span>
          <h1>Membuka cerita di balik angka.</h1>
        </div>
        <div className="analysis-progress-readout"><span>STAGE</span><b>0{activeStep + 1}</b><em>/ 05</em></div>
      </div>

      <div className="analysis-grid">
        <section className="trace-console">
          <div className="trace-console-head"><span><Activity size={15} /> LIVE INVESTIGATION</span><span>STREAM / SERVER EVENTS</span></div>
          <div className="trace-timeline">
            {investigationSteps.map((stage, index) => {
              const state = index < activeStep ? "complete" : index === activeStep ? "active" : "pending";
              return (
                <div className={`trace-stage ${state}`} key={stage.id}>
                  <div className="trace-node-wrap">
                    <span className="trace-node">{state === "complete" ? <Check size={12} /> : ""}</span>
                    {index < investigationSteps.length - 1 && <span className="trace-connector" />}
                  </div>
                  <div className="trace-stage-copy">
                    <span>{stage.meta}</span>
                    <h3>{stage.title}</h3>
                    <p>{traces.find(event => event.stage === ({ evidence: "verify", context: "hunt" } as Record<string, string>)[stage.id] || event.stage === stage.id)?.message ?? stage.subtitle}</p>
                    {stage.id === "evidence" && activeStep >= index && (
                      <div className="trace-event-card"><Database size={14} /><div><b>FETCH COMPANY REPORT</b><span>{fixture?.ticker || "CLAIM"} · {fixture?.category || "GENERAL"}</span></div><em>{fixture ? fixture.evidenceCount : 0} records</em></div>
                    )}
                    {stage.id === "context" && activeStep >= index && (
                      <div className="hypothesis-cloud">
                        {(fixture?.hypotheses || [
                          { code: "CONTEXT_A", status: "CHECKING" },
                          { code: "CONTEXT_B", status: "CHECKING" },
                          { code: "CONTEXT_C", status: "WAIT" },
                        ]).map((hypothesis) => (
                          <span className={hypothesis.status === "TRIGGERED" ? "triggered" : ""} key={hypothesis.code}><b>{hypothesis.code}</b><i>{hypothesis.status}</i></span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="trace-scan"><span /></div>
        </section>

        <aside className="claim-summary-panel">
          <div className="summary-orbit"><VerificationCore small /></div>
          <span className="panel-kicker">CLAIM SUMMARY</span>
          <div className="summary-ticker">${fixture?.ticker || "—"}</div>
          <h3>{fixture?.category || "Custom claim"}</h3>
          <div className="summary-stat"><span>CLAIMED</span><b>{fixture?.claimed || "—"}</b></div>
          <div className="summary-status"><span>CURRENT STATUS</span><b><i className="pulse-dot" /> CHECKING CONTEXT</b></div>
          <div className="summary-module"><Database size={15} /><span>Evidence layer</span><b>{fixture ? `${fixture.evidenceCount} modules` : "waiting"}</b></div>
          <div className="summary-module"><Layers3 size={15} /><span>Hypothesis library</span><b>{activeStep >= 3 ? "running" : "queued"}</b></div>
          <div className="summary-module"><ShieldCheck size={15} /><span>Verdict engine</span><b>{activeStep >= 4 ? "running" : "queued"}</b></div>
        </aside>
      </div>
    </div>
  );
}

function VerdictSeal({ fixture }: { fixture?: DemoFixture }) {
  const tone = fixture?.tone || "violet";
  return (
    <div className={`verdict-seal ${tone}`}>
      <span className="seal-ring" />
      <VerdictIcon tone={tone} size={26} />
      <span>{fixture?.shortStatus || "UNVERIFIABLE"}</span>
    </div>
  );
}

function ActualTrace({ traces }: { traces: readonly TraceEvent[] }) {
  return <div className="trace-summary-grid">{['normalize', 'extract', 'verify', 'hunt', 'adjudicate'].map(stage => {
    const events = traces.filter(event => event.stage === stage);
    const error = traces.find(event => event.stage === 'error');
    return <div key={stage}><span>{stage}</span>{events.length ? <Check size={13} /> : <MinusCircle size={13} />}
      <b>{events.length ? 'Dijalankan' : 'Belum dijalankan'}</b><small>{events.at(-1)?.message || (error ? 'Proses berhenti sebelum tahap ini.' : 'Tidak ada event backend.')}</small>{events.flatMap(traceDetails).map((detail, index) => <small key={index}>{detail}</small>)}</div>;
  })}{traces.filter(event => event.stage === 'error').map((event, index) => <div key={`error-${index}`} role="alert"><AlertTriangle size={15} /><b>Proses terhenti</b><small>{event.message}</small></div>)}</div>;
}

export function ResultView({
  active,
  fixture,
  onSave,
  onDownloadPdf,
  pdfBusy,
  claimIndex,
  onSelectClaim,
  onEvidence,
  traceOpen,
  setTraceOpen,
  reset,
  onRetry,
  onEdit,
}: {
  active: HistoryItem;
  fixture?: DemoFixture;
  onSave: () => void;
  onDownloadPdf: () => void;
  pdfBusy: boolean;
  claimIndex: number;
  onSelectClaim: (index: number) => void;
  onEvidence: () => void;
  traceOpen: boolean;
  setTraceOpen: (open: boolean) => void;
  reset: () => void;
  onRetry: () => void;
  onEdit: () => void;
}) {
  const tone = fixture?.tone || "violet";
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const outcome = checkOutcome(active.result, active.traces);
  if (outcome.kind !== 'complete') return <div className="workspace-page result-view">
    <div className="result-heading"><div><span className="page-index">PEMERIKSAAN BELUM SELESAI</span>
      <h1>{outcome.kind === 'error' ? 'Pemeriksaan terhenti.' : outcome.kind === 'needs_user_choice' ? 'Konfirmasi saham diperlukan.' : 'Belum ada klaim terdeteksi.'}</h1>
      <p role={outcome.kind === 'error' ? 'alert' : 'status'}>{outcome.message}</p></div></div>
    <div className="result-meta-actions">{outcome.kind === 'error' && <button onClick={onRetry}>Coba lagi <ArrowRight size={14} /></button>}<button onClick={onEdit}>{outcome.kind === 'needs_user_choice' ? 'Konfirmasi saham' : 'Tinjau teks'}</button></div>
    <section className="collapsed-trace open"><ActualTrace traces={active.traces} /></section>
  </div>;
  const contextPoints = fixture
    ? [...new Set((fixture.contextPoints?.length ? fixture.contextPoints : [fixture.context, fixture.detail]).filter(Boolean))]
    : ["Evidence belum cukup untuk menyusun konteks."];
  return (
    <div className="workspace-page result-view">
      <div className="result-meta-line">
        <span>CHECK #{active.id.slice(0, 8).toUpperCase()}</span>
        <span>{fixture ? `${fixture.ticker} · ${fixture.category}` : "CUSTOM CLAIM"}</span>
        <span>{fixture?.duration || "—"}</span>
        <span>{fixture?.evidenceCount || 0} EVIDENCE</span>
        <div className="result-meta-actions">
          <button className={active.saved ? "saved" : ""} onClick={onSave}><Bookmark size={14} fill={active.saved ? "currentColor" : "none"} /> {active.saved ? "TERSIMPAN" : "SIMPAN"}</button>
          {active.result.verdicts.length > 0 && <button onClick={onDownloadPdf} disabled={pdfBusy} aria-busy={pdfBusy}>
            {pdfBusy ? <LoaderCircle size={14} className="pdf-spinner" /> : <Download size={14} />} {pdfBusy ? "MENYIAPKAN PDF" : "UNDUH PDF"}
          </button>}
          <button onClick={reset}>CEK BARU <ArrowRight size={14} /></button>
        </div>
      </div>

      <div className="result-heading">
        <div>
          <span className="page-index">INVESTIGATION REPORT</span>
          <h1>{fixture?.headline || "Klaim ini belum dapat diverifikasi tanpa evidence."}</h1>
        </div>
        <VerdictSeal fixture={fixture} />
      </div>

      {active.result.verdicts.length > 1 && (
        <section className="claim-switcher" aria-label="Klaim yang diperiksa">
          <div className="claim-switcher-head"><span>KLAIM DIPERIKSA / {String(active.result.verdicts.length).padStart(2, "0")}</span>
            <span>{Object.entries(active.result.verdicts.reduce<Record<string, number>>((counts, verdict) => ({ ...counts,
              [verdictPresentation[verdict.verdict].status]: (counts[verdictPresentation[verdict.verdict].status] ?? 0) + 1 }), {}))
              .map(([status, count]) => `${count} ${status.toLowerCase()}`).join(" · ")}</span></div>
          <div className="claim-switcher-list">
            {active.result.verdicts.map((verdict, index) => {
              const item = resultFixture(active.result, index, active.text)!;
              return (
                <button key={verdict.claimId} className={index === claimIndex ? "selected" : ""} aria-pressed={index === claimIndex}
                  onClick={() => onSelectClaim(index)}>
                  <span className="claim-switcher-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="claim-switcher-text"><b>{item.ticker} · {item.category}</b><small>{item.quote || active.text}</small></span>
                  <span className={`status-flag ${item.tone}`}><VerdictIcon tone={item.tone} size={12} /> {item.shortStatus}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className={`verdict-hero ${tone}`}>
        <div className="verdict-rings" />
        <div className="verdict-hero-top">
          <div><span>VERDICT</span><b><VerdictIcon tone={tone} size={17} /> {fixture?.status || "Tidak bisa diverifikasi"}</b></div>
          <span>{fixture ? "GROUNDED IN BACKEND EVIDENCE" : "NO EVIDENCE AVAILABLE"}</span>
        </div>
        <div className="verdict-metrics">
          <div className="hero-metric"><span>CLAIMED</span><strong>{fixture?.claimed || "—"}</strong></div>
          <div className="metric-transfer"><span /><i /></div>
          <div className="hero-metric verified"><span>VERIFIED / COMPARISON</span><strong>{fixture?.verified || "—"}</strong></div>
          <div className="hero-metric delta"><span>DELTA</span><strong>{fixture?.delta || "—"}</strong></div>
        </div>
        <div className="verdict-context-line"><Waypoints size={17} /><span>CONTEXT HUNTER</span><p>{fixture?.context || "Evidence numerik belum tersedia untuk klaim ini."}</p></div>
      </section>

      <div className="report-grid">
        <section className="claim-report-module">
          <div className="claim-module-head">
            <div><span>CLAIM {String(claimIndex + 1).padStart(2, "0")} / {fixture?.category || "UNRESOLVED"}</span><blockquote title={fixture?.quote || active.text}>“{fixture?.quote || active.text}”</blockquote></div>
            <div className={`status-flag ${tone}`}><VerdictIcon tone={tone} size={14} /> {fixture?.shortStatus || "UNVERIFIABLE"}</div>
          </div>
          <div className="claim-module-body">
            <div className={`missing-context-card ${tone}`}>
              <div className="module-title"><Layers3 size={16} /><span>CONTEXT YANG HILANG</span></div>
              <ul className="missing-context-points">
                {contextPoints.map(point => <li key={point}>{point}</li>)}
              </ul>
              {fixture && <button className="text-link" onClick={onEvidence}>Buka evidence inspector <ArrowRight size={14} /></button>}
            </div>
          </div>
        </section>

        <aside className={`evidence-inspector ${evidenceOpen ? "open" : "collapsed"}`}>
          <button
            type="button"
            className="inspector-head"
            aria-expanded={evidenceOpen}
            onClick={() => setEvidenceOpen(current => !current)}
          >
            <span>EVIDENCE / {String(fixture?.evidenceCount || 0).padStart(2, "0")}</span>
            <span className="inspector-toggle">{evidenceOpen ? "Tutup" : "Lihat daftar"}<ChevronDown size={16} /></span>
          </button>
          <div className="inspector-content" aria-hidden={!evidenceOpen}>
            <div className="inspector-content-inner">
              {fixture ? (
                <>
                  <div className="inspector-source"><span>SOURCE MODULE</span><b>{fixture.source}</b></div>
                  {fixture.evidence.map((row, index) => (
                    <button className="inspector-row" key={row.label} onClick={onEvidence} tabIndex={evidenceOpen ? 0 : -1}>
                      <span>0{index + 1}</span><div><b>{row.label}</b><small>{row.flag}</small></div><strong>{row.value}</strong><ChevronRight size={14} />
                    </button>
                  ))}
                </>
              ) : (
                <div className="inspector-empty"><CircleDashed size={28} /><p>Backend tidak mengembalikan evidence untuk klaim ini.</p></div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <section className={`collapsed-trace ${traceOpen ? "open" : ""}`}>
        <button onClick={() => setTraceOpen(!traceOpen)}>
          <span><CheckCircle2 size={16} /> {active.traces.some(event => event.stage === 'error') ? 'Jejak backend · ada kendala' : 'Jejak backend'} {fixture ? `· ${fixture.duration}` : ""}</span>
          <span>Lihat jejak kerja <ChevronDown size={15} /></span>
        </button>
        {traceOpen && (
          <ActualTrace traces={active.traces} />
        )}
      </section>
    </div>
  );
}

function HistoryPage({
  title,
  subtitle,
  items,
  openReport,
}: {
  title: string;
  subtitle: string;
  items: HistoryItem[];
  openReport: (item: HistoryItem) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => item.text.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="workspace-page history-page">
      <div className="history-head">
        <div><span className="page-index">ARCHIVE / REPORTS</span><h1>{title}</h1><p>{subtitle}</p></div>
        <label className="history-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari klaim..." /></label>
      </div>
      <div className="history-table-head"><span>WAKTU</span><span>TICKER</span><span>TIPE</span><span>KLAIM</span><span>STATUS</span><span /></div>
      <div className="history-list">
        {filtered.length ? filtered.map((item) => {
          const fixture = resultFixture(item.result);
          return (
            <button className="history-row" key={item.id} onClick={() => openReport(item)}>
              <span className="history-time"><b>{new Date(item.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }).toUpperCase()}</b><small>{new Date(item.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</small></span>
              <strong>{fixture?.ticker || "—"}</strong>
              <span>{fixture?.category || "CUSTOM"}</span>
              <p>“{item.text}”</p>
              <span className={`history-status ${fixture?.tone || "violet"}`}><VerdictIcon tone={fixture?.tone || "violet"} size={13} /> {fixture?.shortStatus || "UNVERIFIABLE"}</span>
              <ArrowRight size={16} />
            </button>
          );
        }) : (
          <div className="history-empty">
            <VerificationCore small />
            <h3>Belum ada report di sini.</h3>
            <p>Rapor backend yang kamu jalankan akan muncul sebagai baris investigasi.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App({ initialPage = "landing" }: { initialPage?: Page }) {
  const [page, setPage] = useState<Page>(initialPage);
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>(readHistory);
  const [active, setActive] = useState<HistoryItem | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [modal, setModal] = useState<"evidence" | null>(null);
  const [toast, setToast] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [viewRevision, setViewRevision] = useState(0);
  const [landingDestination, setLandingDestination] = useState<LandingView>("home");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [error, setError] = useState("");
  const [inputSource, setInputSource] = useState<CheckSource>("paste");
  const [inputUrl, setInputUrl] = useState<string | undefined>();
  const [choices, setChoices] = useState<UiTickerChoice[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const [claimIndex, setClaimIndex] = useState(0);
  // Rapor lain dibuka: mulai lagi dari klaim pertama.
  useEffect(() => { setClaimIndex(0); }, [active?.id]);
  const activeFixture = useMemo(
    () => active ? resultFixture(active.result, claimIndex, active.text) : undefined,
    [active, claimIndex],
  );
  const inputFixture = useMemo(
    () => examples.find((example) => example.text === input.trim()),
    [input],
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch {
      // Frontend demo still works when storage is unavailable.
    }
  }, [history]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); abortRef.current?.abort(); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function chooseExample(id: DemoId) {
    const fixture = examples.find((example) => example.id === id);
    if (!fixture) return;
    setInput(fixture.text);
    setInputSource("paste"); setInputUrl(undefined);
    setActive(null);
    setPhase("idle");
  }

  function enterWorkspace(run = false) {
    setPage("check");
    setActive(null);
    setPhase("idle");
    setViewRevision((current) => current + 1);
    window.scrollTo({ top: 0 });
    if (run && input.trim()) {
      setTimeout(startCheck, 40);
    }
  }

  async function startCheck() {
    if (!input.trim()) return;
    clearTimers();
    setPage("check");
    setPhase("analyzing");
    setActive(null);
    setActiveStep(0);
    setTraces([]);
    setChoices([]);
    setError("");
    setTraceOpen(false);
    setViewRevision((current) => current + 1);

    const controller = new AbortController();
    abortRef.current = controller;
    const received: TraceEvent[] = [];
    const stageIndex: Partial<Record<TraceEvent["stage"], number>> = { normalize: 0, extract: 1, route: 2, verify: 2, hunt: 3, adjudicate: 4, done: 4 };
    try {
      const response = await fetch("/api/check", {
        method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.trim(), source: inputSource, ...(inputUrl ? { url: inputUrl } : {}),
          userSelections: Object.entries(selections).filter(([, ticker]) => ticker).map(([surface, ticker]) => ({ surface, ticker })) }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json();
        throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Permintaan ditolak.");
      }
      await readCheckStream(response, event => {
        if (event.kind === "trace") {
          received.push(event.value); setTraces([...received]);
          setActiveStep(stageIndex[event.value.stage] ?? 0);
          if (event.value.stage === "normalize") setChoices(readTickerChoices(event.value));
        } else if (event.kind === "error") { setError(event.value.message); setPhase("idle"); }
        else {
          const item = HistoryItemSchema.parse({ id: event.value.checkId, text: input.trim(), createdAt: new Date().toISOString(),
            saved: false, demo: false, source: inputSource, ...(inputUrl ? { url: inputUrl } : {}), result: event.value, traces: received });
          setActive(item);
          setHistory(current => [item, ...current.filter(entry => entry.id !== item.id)].slice(0, 50));
          setPhase("result");
        }
      });
    } catch (cause) {
      setError(controller.signal.aborted ? "Pemeriksaan dibatalkan." : cause instanceof Error ? cause.message : "Pemeriksaan gagal.");
      setPhase("idle");
    } finally { abortRef.current = null; }
  }

  function openReport(item: HistoryItem) {
    clearTimers();
    setActive(item);
    setInput(item.text);
    setInputSource(item.source ?? "paste");
    setInputUrl(item.url);
    const normalization = item.traces.find(event => event.stage === "normalize");
    setChoices(normalization ? readTickerChoices(normalization) : []);
    setSelections({});
    setPhase("result");
    setPage("check");
    setTraceOpen(false);
    setTraces(item.traces);
    setViewRevision((current) => current + 1);
  }

  function toggleSave() {
    if (!active) return;
    const current = history.find((item) => item.id === active.id);
    const nextSaved = !(current?.saved ?? active.saved);
    setHistory((items) => items.map((item) => item.id === active.id ? { ...item, saved: nextSaved } : item));
    setActive((item) => item ? { ...item, saved: nextSaved } : item);
    setToast(nextSaved ? "Report disimpan." : "Report dihapus dari tersimpan.");
  }

  async function downloadPdf() {
    if (!active || pdfBusy) return;
    setPdfBusy(true);
    try { await downloadReportPdf(active); }
    catch { setToast("Rapor PDF belum dapat dibuat. Coba lagi."); }
    finally { setPdfBusy(false); }
  }

  function resetCheck() {
    clearTimers();
    setActive(null);
    setPhase("idle");
    setInput("");
    setInputSource("paste"); setInputUrl(undefined);
    setActiveStep(0);
    setTraceOpen(false);
    setTraces([]);
    setChoices([]); setSelections({});
    setError("");
    setViewRevision((current) => current + 1);
  }

  if (page === "landing") {
    return (
      <LandingPage
        input={input}
        setInput={setInput}
        chooseExample={chooseExample}
        enterWorkspace={enterWorkspace}
        initialView={landingDestination}
      />
    );
  }

  const savedItems = history.filter((item) => item.saved);

  return (
    <div className="workspace-shell">
      <AppSidebar
        page={page}
        setPage={(next) => {
          clearTimers();
          setPage(next);
          setViewRevision((current) => current + 1);
          if (next === "check" && phase === "analyzing") {
            setPhase("idle");
            setActive(null);
          }
        }}
        historyCount={history.length}
        savedCount={savedItems.length}
        goLanding={(view = "home") => {
          clearTimers();
          setLandingDestination(view);
          setPage("landing");
          setPhase("idle");
          setViewRevision((current) => current + 1);
          window.scrollTo({ top: 0 });
        }}
      />
      <div className="workspace-main">
        <AppTopbar phase={phase} />
        <main className="workspace-canvas">
          <div className="canvas-grid" />
          <div className="canvas-glow canvas-glow-a" />
          <div className="canvas-glow canvas-glow-b" />

          <div
            key={`${page}-${phase}-${viewRevision}`}
            className="workspace-view-transition"
          >
            {page === "check" && phase === "idle" && (
              <IdleCheck
                input={input}
                setInput={setInput}
                running={false}
                chooseExample={chooseExample}
                startCheck={startCheck}
                onPrepared={prepared => { setInputSource(prepared.source); setInputUrl(prepared.url); }}
              />
            )}
            {page === "check" && phase === "analyzing" && (
              <AnalyzingView input={input} activeStep={activeStep} fixture={inputFixture} traces={traces} />
            )}
            {page === "check" && phase === "result" && active && (
              <ResultView
                active={active}
                fixture={activeFixture}
                onSave={toggleSave}
                onDownloadPdf={downloadPdf}
                pdfBusy={pdfBusy}
                claimIndex={claimIndex}
                onSelectClaim={setClaimIndex}
                onEvidence={() => setModal("evidence")}
                traceOpen={traceOpen}
                setTraceOpen={setTraceOpen}
                reset={resetCheck}
                onRetry={startCheck}
                onEdit={() => { setActive(null); setPhase("idle"); }}
              />
            )}
            {page === "history" && (
              <HistoryPage
                title="Riwayat pemeriksaan"
                subtitle="Semua klaim yang pernah kamu jalankan pada demo frontend ini."
                items={history}
                openReport={openReport}
              />
            )}
            {page === "saved" && (
              <HistoryPage
                title="Rapor tersimpan"
                subtitle="Koleksi report yang kamu tandai untuk dibuka kembali."
                items={savedItems}
                openReport={openReport}
              />
            )}
          </div>
          {choices.length > 0 && phase === "idle" && <fieldset className="ticker-choice">
            <legend>Pilih saham yang dimaksud, lalu periksa kembali</legend>
            {choices.map(choice => <label key={choice.surface}>Sebutan “{choice.surface}”
              <select value={selections[choice.surface] ?? ""} onChange={event => setSelections(current => ({ ...current, [choice.surface]: event.target.value }))}>
                <option value="">Pilih saham</option>
                {choice.candidates.map(candidate => <option key={candidate.ticker} value={candidate.ticker}>{candidate.ticker} — {candidate.label}</option>)}
              </select>
            </label>)}
            <button className="primary-action" disabled={choices.some(choice => !selections[choice.surface])} onClick={() => void startCheck()}>Periksa dengan pilihan ini <ArrowRight size={17} /></button>
          </fieldset>}
          {error && <p className="backend-error" role="alert">{error}</p>}
        </main>
        <LegalStrip />
      </div>

      {modal === "evidence" && activeFixture && (
        <Modal title="Evidence inspector" onClose={() => setModal(null)}>
          <div className="modal-evidence-meta">
            <span>{activeFixture.ticker}</span><span>{activeFixture.category}</span><span>{activeFixture.source}</span>
          </div>
          <div className="modal-evidence-list">
            {activeFixture.evidence.map((row, index) => (
              <div key={row.label}><span>0{index + 1}</span><div><b>{row.label}</b><small>{row.flag}</small></div><strong>{row.value}</strong></div>
            ))}
          </div>
          <p className="modal-note">Semua angka pada layar ini berasal dari objek evidence backend. Pemeriksaan berjalan dalam mode cache_only.</p>
        </Modal>
      )}

      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </div>
  );
}
