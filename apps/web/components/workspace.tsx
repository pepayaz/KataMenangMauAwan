"use client";

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
} from "../lib/check-view";
import { verdictLabels, verdictTone, historyMatches, HistoryItemSchema } from "../lib/check-view";
import { readCheckStream } from "../lib/check-stream";
import { readTickerChoices, type UiTickerChoice } from "../lib/ticker-choices";
import type { TraceEvent } from "@cek-dulu/shared/schemas";
import CheckReport from "./check-report";
import InputAdapter from "./input-adapter";
import { InputAdaptationSchema, type CheckSource, type InputAdaptation } from "@cek-dulu/shared/schemas";
import { fetchRemoteHistory, fetchRemoteReport, sessionHeaders, type RemoteCheck } from "../lib/history-client";

type Page = "check" | "history" | "saved" | "guide";
const steps = ["Mengenali emiten dan klaim", "Memverifikasi angka", "Mencari konteks", "Menentukan status dan memeriksa penjelasan"];
const stageStep: Record<string, number> = { normalize: 0, extract: 0, route: 1, verify: 1, hunt: 2, adjudicate: 3, done: 3 };


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

export default function Workspace({ fixtureDemo }: { fixtureDemo: boolean }) {
  const [page, setPage] = useState<Page>("check");
  const [input, setInput] = useState("");
  const [inputSource, setInputSource] = useState<CheckSource>('paste');
  const [inputUrl, setInputUrl] = useState<string | undefined>();
  const [inputWarnings, setInputWarnings] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [active, setActive] = useState<HistoryItem | null>(null);
  const [running, setRunning] = useState(false);
  const [inputBusy, setInputBusy] = useState(false);
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
  const [storageReady, setStorageReady] = useState(false);
  const [demo, setDemo] = useState(false), [error, setError] = useState('');
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [choices, setChoices] = useState<UiTickerChoice[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [remoteChecks, setRemoteChecks] = useState<RemoteCheck[]>([]), [remoteNote, setRemoteNote] = useState('');
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  useEffect(() => { void fetch('/api/check').then(response => response.json()).then(body => setLlmReady(body.llmConfigured === true)).catch(() => setLlmReady(false)); }, []);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => { setHistory(readHistory()); setStorageReady(true); }, []);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem(storageKey, JSON.stringify(history)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [history, storageReady]);
  useEffect(() => () => abortRef.current?.abort(), []);
  async function loadRemote() {
    const response = await fetchRemoteHistory();
    setRemoteChecks(response.checks); setRemoteNote(response.message);
  }
  async function openRemote(checkId: string) {
    try {
      const item = await fetchRemoteReport(checkId);
      setHistory(previous => [item, ...previous.filter(entry => entry.id !== item.id)].slice(0, 50));
      openReport(item);
    } catch { setToast('Riwayat server belum dapat dimuat.'); }
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  function navigate(next: Page) {
    if (next === 'history') void loadRemote();
    setPage(next);
    setMobileMenu(false);
    setQuery("");
    setFilter("Semua");
  }
  function acceptInput(prepared: InputAdaptation) {
    setInput(prepared.rawText); setInputSource(prepared.source); setInputUrl(previous => prepared.url ?? previous);
    setInputWarnings(prepared.warnings); setDemo(false); setChoices([]); setSelections({}); setActive(null); setTraces([]); setError('');
    inputRef.current?.focus();
  }
  useEffect(() => {
    try {
      const shared = sessionStorage.getItem('cek-dulu-share-input');
      if (!shared) return;
      sessionStorage.removeItem('cek-dulu-share-input');
      const parsed = InputAdaptationSchema.safeParse(JSON.parse(shared));
      if (parsed.success) acceptInput(parsed.data);
    } catch { setError('Input berbagi belum dapat dibuka. Tempel teks atau unggah screenshot.'); }
  }, []);
  function chooseExample(id: DemoId) {
    const example = examples.find((item) => item.id === id)!;
    setInputSource('paste'); setInputUrl(undefined); setInputWarnings([]);
    setInput(example.text); setSelections({}); setChoices([]); setError('');
    inputRef.current?.focus();
  }
  async function startCheck() {
    if (!input.trim() || running || inputBusy) return;
    const text = input.trim(), isDemo = demo;
    const controller = new AbortController(); abortRef.current = controller;
    setRunning(true); setActive(null); setStep(0); setTraces([]); setChoices([]); setError('');
    const received: TraceEvent[] = [];
    try {
      const response = await fetch('/api/check', { method: 'POST', signal: controller.signal,
        headers: { ...(isDemo ? {} : await sessionHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ text, source: inputSource, url: inputUrl, demo: isDemo,
          userSelections: Object.entries(selections).filter(([, ticker]) => ticker).map(([surface, ticker]) => ({ surface, ticker })) }) });
      if (!response.ok) {
        const body: unknown = await response.json();
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Permintaan ditolak.';
        throw new Error(message);
      }
      await readCheckStream(response, event => {
        if (event.kind === 'trace') {
          received.push(event.value); setTraces([...received]);
          if (stageStep[event.value.stage] !== undefined) setStep(stageStep[event.value.stage]!);
          if (event.value.stage === 'normalize') setChoices(readTickerChoices(event.value));
          if (event.value.stage === 'error') setError(event.value.message);
        } else if (event.kind === 'error') setError(event.value.message);
        else {
          const item = HistoryItemSchema.parse({ id: event.value.checkId, text, createdAt: new Date().toISOString(),
            saved: false, demo: isDemo, source: inputSource, url: inputUrl, result: event.value, traces: received });
          setActive(item);
          // Pilihan/kegagalan ekstraksi bukan rapor untuk riwayat.
          if (item.result.verdicts.length) setHistory(previous => [item, ...previous].slice(0, 50));
        }
      });
    } catch (cause) {
      setError(controller.signal.aborted ? 'Tampilan pemeriksaan dibatalkan. Server dapat tetap menyelesaikan cek.'
        : cause instanceof Error ? cause.message : 'Pemeriksaan tidak dapat diselesaikan.');
    } finally { setRunning(false); abortRef.current = null; }
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
    setActive(item); setDemo(fixtureDemo && item.demo); setInputSource(item.source ?? 'paste'); setInputUrl(item.url); setInputWarnings([]);
    setInput(item.text); setTraces(item.traces); setError(''); setChoices([]); setSelections({});
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
  const filteredHistory = history.filter(item => historyMatches(item, query, filter, page === 'saved'));

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
              <small>Tanpa akun</small>
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
              <span className="status-dot" /> {demo ? "Demo fixture" : "Cache only"}
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
                    <InputAdapter disabled={running || inputBusy} onPrepared={acceptInput} onBusyChange={setInputBusy} />
                    {inputUrl && <p className="input-origin">Link sumber: <a href={inputUrl} target="_blank" rel="noreferrer">{inputUrl}</a><button type="button" className="text-button" disabled={running || inputBusy} onClick={() => setInputUrl(undefined)}>Lepas link</button></p>}
                    {inputWarnings.length > 0 && <div role="status" className="input-review">{inputWarnings.map((warning,index) => <p key={index}>{warning}</p>)}<p>Koreksi teks di bawah, lalu tekan Cek klaim ini.</p></div>}
                    <label className="sr-only" htmlFor="claim">
                      Teks klaim saham
                    </label>
                    <textarea
                      id="claim"
                      ref={inputRef}
                      value={input}
                      maxLength={5000}
                      disabled={running || inputBusy}
                      onChange={(event) => { setInput(event.target.value); setSelections({}); setChoices([]); }}
                      placeholder={
                        "“Katanya yield dividen ADRO 25% setahun.\nBeneran segampang itu?”"
                      }
                    />
                    <div className="input-meta">
                      <span>
                        Tempel klaim dari X, TikTok, atau grup obrolan.
                      </span>
                      <span>
                        {input.length.toLocaleString("id-ID")} / 5.000
                      </span>
                    </div>
                    <div className="example-row">
                      <span>Coba contoh</span>
                      {examples.map((example) => (
                        <button
                          key={example.id}
                          type="button"
                          disabled={running || inputBusy}
                          onClick={() => chooseExample(example.id)}
                          className={`example-chip ${input === example.text ? "selected" : ""}`}
                        >
                          {example.ticker}
                          <span>{example.category}</span>
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                    <div className="integration-controls">
                      {fixtureDemo && <label><input type="checkbox" checked={demo} disabled={running || inputBusy}
                        onChange={event => { setDemo(event.target.checked); setChoices([]); setSelections({}); }} /> Demo fixture offline</label>}
                      {running && <button type="button" className="text-button" onClick={() => abortRef.current?.abort()}>Batalkan tampilan</button>}
                    </div>
                    {choices.length > 0 && <fieldset className="ticker-choice" disabled={running || inputBusy}>
                      <legend>Pilih saham yang dimaksud, lalu cek kembali</legend>
                      {choices.map(choice => <label key={choice.surface}>Sebutan “{choice.surface}”{' '}
                        {choice.candidates.length ? <select aria-label={`Saham untuk ${choice.surface}`} value={selections[choice.surface] ?? ''}
                          onChange={event => setSelections(previous => ({ ...previous, [choice.surface]: event.target.value }))}>
                          <option value="">Pilih saham</option>{choice.candidates.map(candidate => <option key={candidate.ticker} value={candidate.ticker}>{candidate.ticker} — {candidate.label}</option>)}
                        </select> : <span>Tidak ada kandidat. Perbaiki teks dengan kode saham eksplisit.</span>}
                      </label>)}
                    </fieldset>}
                    <div className="input-card-footer">
                      <span>
                        <ShieldCheck size={15} /> Tanpa login. Mulai dari rasa
                        penasaran.
                      </span>
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={!input.trim() || running || inputBusy || choices.some(choice => !selections[choice.surface])}
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
                  {demo ? "Demo memakai fixture offline; angka contoh bukan data pasar terkini." : "Klaim diperiksa melalui pipeline backend. Data yang belum tersedia akan dinyatakan terbuka."}
                </span>
                <span className="notice-label">{demo ? "FIXTURE" : "CACHE_ONLY"}</span>
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
                      <span className="eyebrow">JEJAK PEMERIKSAAN</span>
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
                      <span className="small-tag">{active.demo ? "RAPOR DEMO" : "RAPOR KLAIM"}</span>
                    </div>
                    {active.result.verdicts.length > 0 && <button
                      className={`text-button ${active.saved ? "is-saved" : ""}`}
                      onClick={() => toggleSave(active)}
                    >
                      <Bookmark
                        size={16}
                        fill={active.saved ? "currentColor" : "none"}
                      />
                      {active.saved ? "Tersimpan" : "Simpan rapor"}
                    </button>}
                  </div>
                  <CheckReport item={active} />
                </section>
              )}

              {llmReady === false && !demo && <p className="integration-error" role="status">Konfigurasi LLM belum tersedia. Pemeriksaan normal memerlukan konfigurasi server dan cache Sectors. Demo fixture dapat dipakai untuk menguji alur.</p>}
              {error && <p className="integration-error" role="alert">{error}</p>}
              {traces.length > 0 && <details className="trace-panel" open>
                <summary>Jejak pemeriksaan · {traces.length} event</summary>
                <ol>{traces.map((trace, index) => <li key={index}><strong>{trace.stage}</strong>: {trace.message} · {trace.credits ?? 0} kredit
                  {trace.data !== undefined && <details><summary>Detail tahap</summary><pre>{JSON.stringify(trace.data, null, 2)}</pre></details>}
                </li>)}</ol>
              </details>}
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
                      disabled={running || inputBusy}
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
                          ? "“Yield 25,5% setahun. Angka mana yang dirujuk?”"
                          : example.id === "valuation"
                            ? "“PER cuma 3x. Sudah pasti murah?”"
                            : "“Bakal naik 80%. Bisa dibuktikan?”"}
                      </h3>
                      <div className="explore-bottom">
                        <span>
                          {example.id === "dividend"
                            ? "Ada rata-rata yang menyembunyikan cerita."
                            : example.id === "valuation"
                              ? "Cek rasionya, bukan hanya narasinya."
                              : "Prediksi bukan fakta historis."}
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
                    <option>Benar tapi menyesatkan</option><option>Tidak bisa diverifikasi</option><option>Di luar cakupan</option>
                  </select>
                </label>
              </div>
              {page === 'history' && <section className="remote-history">
                <h2>Riwayat server</h2><p role="status">{remoteNote || 'Memuat status sesi…'}</p>
                {remoteChecks.map(check => <button className="history-open" key={check.checkId} onClick={() => void openRemote(check.checkId)}>{check.excerpt} · {check.claimCount} klaim</button>)}
              </section>}
              <div className="history-count">
                {filteredHistory.length} RAPOR{" "}
                {page === "saved" ? "TERSIMPAN" : "DI PERANGKAT INI"}
              </div>
              {filteredHistory.length ? (
                <div className="history-list">
                  {filteredHistory.map((item) => {
                    const firstVerdict = item.result.verdicts[0];
                    const example = firstVerdict ? { ticker: item.result.claims[0]?.ticker ?? 'KLAIM', tone: verdictTone[firstVerdict.verdict], status: verdictLabels[firstVerdict.verdict] } : undefined;
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
                            <span>· {item.demo ? "DEMO FIXTURE" : "HASIL BACKEND"}</span>
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
                      : "Coba periksa satu contoh klaim. Rapor hasil pemeriksaan akan muncul di riwayat dan bisa kamu simpan."}
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
            <p>Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi. Status klaim menilai kesesuaian klaim dengan data yang tersedia, bukan kelayakan membeli atau menjual saham. Data bersumber dari Sectors dan dapat tertinggal dari kondisi terkini. Lakukan riset sendiri sebelum mengambil keputusan.</p>
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
              <b>Pipeline agen terhubung ke backend.</b>
              <p>
                Pemeriksaan normal memakai LLM terkonfigurasi dan cache Sectors. Demo fixture tersedia secara terpisah. Riwayat anonim tersimpan di perangkat; sesi Supabase dapat memuat riwayat server.
              </p>
            </div>
          </div>
          <p>
            Mode demo berisi ilustrasi offline. Pemeriksaan normal memerlukan konfigurasi server dan data cache yang tersedia.
          </p>
        </Modal>
      )}

    </div>
  );
}
