"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  FileText,
  History,
  Layers3,
  LoaderCircle,
  Menu,
  MessageSquareQuote,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  examples,
  readHistory,
  storageKey,
  type DemoId,
  type HistoryItem,
} from "../lib/check-view";
import { verdictLabels, historyMatches, HistoryItemSchema } from "../lib/check-view";
import { readCheckStream } from "../lib/check-stream";
import { readTickerChoices, type UiTickerChoice } from "../lib/ticker-choices";

import type { TraceEvent } from "@cek-dulu/shared/schemas";
import CheckReport from "./check-report";
import InputAdapter, { type InputMode } from "./input-adapter";
import InvestigationPreview from "./investigation-preview";
import TraceTimeline from "./trace-timeline";
import VerdictBadge from "./verdict-badge";
import { InputAdaptationSchema, type CheckSource, type InputAdaptation } from "@cek-dulu/shared/schemas";
import { fetchRemoteHistory, fetchRemoteReport, sessionHeaders, type RemoteCheck } from "../lib/history-client";

/** Nilai select untuk sebutan yang pengguna nyatakan bukan saham; dikirim sebagai ticker null. */
const NOT_A_STOCK = "__bukan_saham__";

type Page = "check" | "history" | "saved" | "guide";


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
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); trigger?.focus({ preventScroll: true }); };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="workspace-dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <span>Cek Dulu</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Tutup dialog"
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="workspace-dialog-title">{title}</h2>
      {children}
      <button className="primary-button" onClick={onClose}>
        Mengerti <Check size={17} />
      </button>
    </dialog>
  );
}

export default function Workspace({ fixtureDemo }: { fixtureDemo: boolean }) {
  const [page, setPage] = useState<Page>("check");
  const [input, setInput] = useState("");
  const [inputSource, setInputSource] = useState<CheckSource>('paste');
  const [inputUrl, setInputUrl] = useState<string | undefined>();
  const [inputWarnings, setInputWarnings] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaNeedsText, setMediaNeedsText] = useState(false);
  const showText = inputMode === 'text' || mediaReady;
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [active, setActive] = useState<HistoryItem | null>(null);
  const [running, setRunning] = useState(false);
  const [inputBusy, setInputBusy] = useState(false);
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
  const activeCheckId = active?.id;
  useEffect(() => {
    if (!activeCheckId || running) return;
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    resultRef.current?.focus({ preventScroll: true });
  }, [activeCheckId, running]);
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
    setMediaReady(true);
    setMediaNeedsText(prepared.status === 'needs_text');
    setInput(prepared.rawText); setInputSource(prepared.source); setInputUrl(previous => prepared.url ?? previous);
    setInputWarnings(prepared.warnings); setDemo(false); setChoices([]); setSelections({}); setActive(null); setTraces([]); setError('');
    timers.current.push(setTimeout(() => inputRef.current?.focus(), 0));
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
    setInputMode('text'); setMediaReady(false);
    const example = examples.find((item) => item.id === id)!;
    setInputSource('paste'); setInputUrl(undefined); setInputWarnings([]);
    setInput(example.text); setSelections({}); setChoices([]); setError('');
    setActive(null); setTraces([]);
    timers.current.push(setTimeout(() => inputRef.current?.focus(), 0));
  }
  async function startCheck() {
    if (!input.trim() || running || inputBusy || !showText) return;
    const text = input.trim(), isDemo = demo;
    const controller = new AbortController(); abortRef.current = controller;
    setRunning(true); setActive(null); setTraces([]); setChoices([]); setError('');
    const received: TraceEvent[] = [];
    try {
      const response = await fetch('/api/check', { method: 'POST', signal: controller.signal,
        headers: { ...(isDemo ? {} : await sessionHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ text, source: inputSource, url: inputUrl, demo: isDemo,
          userSelections: Object.entries(selections).filter(([, ticker]) => ticker)
            .map(([surface, ticker]) => ({ surface, ticker: ticker === NOT_A_STOCK ? null : ticker })) }) });
      if (!response.ok) {
        const body: unknown = await response.json();
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Permintaan ditolak.';
        throw new Error(message);
      }
      await readCheckStream(response, event => {
        if (event.kind === 'trace') {
          received.push(event.value); setTraces([...received]);
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
    setInputMode('text'); setMediaReady(false);
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
    <div className="app-shell" onKeyDown={event => { if (event.key === 'Escape') setMobileMenu(false); }}>
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="Tutup menu"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside id="workspace-navigation" className={`sidebar ${mobileMenu ? "is-open" : ""}`}>
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
              {id !== "check" && (
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
        </button>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setModal("about")}><CircleHelp size={19} /><span>Tentang Cek Dulu</span></button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Buka menu"
              aria-expanded={mobileMenu}
              aria-controls="workspace-navigation"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={22} />
            </button>
            <span>Cek Dulu</span>
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
              <span className="status-dot" /> {demo ? "Demo offline" : "Data tersimpan"}
            </span>
            <span className="topbar-divider" />
            <button className="about-button" onClick={() => setModal("about")}>
              Tentang Cek Dulu
            </button>
          </div>
        </header>
        <main>
          {page === "check" && (
            <>
              <section className="page-heading">
                <h1>Periksa klaim saham</h1>
                <p>Tempel teks atau baca konten dari screenshot dan video.</p>
              </section>
              <div className="check-layout">
                <section className="input-card">
                  <div className="input-card-heading">
                    <span>
                      <MessageSquareQuote size={19} /> Masukkan klaim
                    </span>
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      startCheck();
                    }}
                  >
                    <InputAdapter disabled={running || inputBusy} mode={inputMode} prepared={mediaReady} needsText={mediaNeedsText}
                      onModeChange={mode => { setInputMode(mode); if (mode !== 'text') setDemo(false); setMediaReady(false); setMediaNeedsText(false); setInputWarnings([]); setInputUrl(undefined); setInputSource('paste'); setChoices([]); setSelections({}); setActive(null); setTraces([]); setError(''); }}
                      onReset={() => { setMediaReady(false); setMediaNeedsText(false); setInputWarnings([]); setInputUrl(undefined); setChoices([]); setSelections({}); setActive(null); setTraces([]); setError(''); }}
                      onPrepared={acceptInput} onBusyChange={setInputBusy} />
                    {showText && <>
                    {inputUrl && <p className="input-origin">Link sumber: <a href={inputUrl} target="_blank" rel="noreferrer">{inputUrl}</a><button type="button" className="text-button" disabled={running || inputBusy} onClick={() => setInputUrl(undefined)}>Lepas link</button></p>}
                    {inputWarnings.length > 0 && <div role="status" className="input-review">{inputWarnings.map((warning,index) => <p key={index}>{warning}</p>)}<p>Koreksi teks di bawah, lalu tekan Cek klaim ini.</p></div>}
                    <label className="editor-label" htmlFor="claim">
                      {inputMode === 'text' ? 'Teks klaim saham' : 'Tinjau hasil pembacaan'}
                    </label>
                    <textarea
                      id="claim"
                      ref={inputRef}
                      value={input}
                      maxLength={5000}
                      disabled={running || inputBusy}
                      onChange={(event) => { setInput(event.target.value); setSelections({}); setChoices([]); setActive(null); setTraces([]); setError(''); }}
                      placeholder={
                        "Contoh: ADRO yield 25,5% setahun"
                      }
                    />
                    <div className="input-meta">
                      <span>
                        {inputMode === 'text' ? 'Sertakan nama saham, angka, dan periode jika ada.' : 'Koreksi teks yang salah terbaca sebelum memeriksa.'}
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
                        <select aria-label={`Saham untuk ${choice.surface}`} value={selections[choice.surface] ?? ''}
                          onChange={event => setSelections(previous => ({ ...previous, [choice.surface]: event.target.value }))}>
                          <option value="">Pilih saham</option>{choice.candidates.map(candidate => <option key={candidate.ticker} value={candidate.ticker}>{candidate.ticker} — {candidate.label}</option>)}
                          <option value={NOT_A_STOCK}>Bukan saham</option>
                        </select>{!choice.candidates.length && <span> Tidak ada kandidat; pilih “Bukan saham” atau tulis kode saham eksplisit.</span>}
                      </label>)}
                    </fieldset>}
                    <div className="input-card-footer">
                      <span>
                        {inputMode === 'text' ? 'Maksimal 5.000 karakter' : 'Teks ini akan diperiksa'}
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
                            Cek klaim ini
                          </>
                        )}
                      </button>
                    </div>
                    </>}
                  </form>
                </section>
                <InvestigationPreview disabled={running || inputBusy} onExplore={() => chooseExample('dividend')} />
              </div>
              {demo && <p className="demo-notice">Demo memakai data contoh historis, bukan data pasar terkini.</p>}

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
                      <h3>Memeriksa klaim</h3>
                    </div>
                  </div>
                  <TraceTimeline events={traces} running />
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
                      <h2>Hasil pemeriksaan</h2>
                      {active.demo && <span className="small-tag">Contoh historis</span>}
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
              {traces.length > 0 && !running && <details className="trace-panel">
                <summary>Jejak pemeriksaan · {traces.length} event</summary>
                <TraceTimeline events={traces} />
              </details>}
            </>
          )}

          {(page === "history" || page === "saved") && (
            <section className="collection-page">
              <div className="collection-heading">
                <div>
                  <h1>
                    {page === "saved"
                      ? "Rapor tersimpan"
                      : "Riwayat pemeriksaan"}
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
                            {item.result.claims[0]?.ticker || "KLAIM BEBAS"}
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
                          <VerdictBadge verdict={firstVerdict?.verdict ?? 'unverifiable'} />
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
                        ? "Belum ada rapor tersimpan"
                        : "Belum ada riwayat pemeriksaan"}
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
              <h1>Cara pemeriksaan bekerja</h1>
              <p className="guide-intro">Kenali tahapan pemeriksaan dan arti setiap status pada rapor.</p>
              <div className="guide-grid">
                {[
                  {
                    icon: MessageSquareQuote,
                    title: "Ekstraksi klaim",
                    text: "Teks diurai menjadi pernyataan yang bisa diperiksa. “PER 3x” adalah klaim angka. “Pasti cuan” adalah prediksi.",
                  },
                  {
                    icon: ChartNoAxesCombined,
                    title: "Perbandingan data",
                    text: "Pada produk terintegrasi, data Sectors menjadi pembanding. Perhitungan dilakukan oleh kode, dengan periode yang sesuai.",
                  },
                  {
                    icon: Layers3,
                    title: "Pemeriksaan konteks",
                    text: "Context Hunter menelusuri kemungkinan pembayaran satu kali, basis pembanding rendah, atau periode yang dipilih-pilih.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Hasil dan sumber",
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
                <h2>Arti status pemeriksaan</h2>
                <div>
                  {[
                    {
                      verdict: "supported" as const,
                      title: "Didukung",
                      text: "Klaim sesuai dengan data pembanding.",
                    },
                    {
                      verdict: "refuted" as const,
                      title: "Dibantah",
                      text: "Klaim tidak sesuai dengan data pembanding.",
                    },
                    {
                      verdict: "misleading" as const,
                      title: "Benar tapi menyesatkan",
                      text: "Angka sesuai, tetapi konteks penting hilang.",
                    },
                    {
                      verdict: "unverifiable" as const,
                      title: "Tidak bisa diverifikasi",
                      text: "Data belum cukup atau klaim terlalu kabur.",
                    },
                    {
                      verdict: "out_of_scope" as const,
                      title: "Di luar cakupan",
                      text: "Prediksi atau opini, bukan klaim faktual.",
                    },
                  ].map((item) => (
                    <div key={item.title}>
                      <VerdictBadge verdict={item.verdict} />
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <button
                className="primary-button"
                onClick={() => navigate("check")}
              >
                Periksa klaim
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
            </div>
            <p>Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi. Status klaim menilai kesesuaian klaim dengan data yang tersedia, bukan kelayakan membeli atau menjual saham. Data bersumber dari Sectors dan dapat tertinggal dari kondisi terkini. Lakukan riset sendiri sebelum mengambil keputusan.</p>
            <button onClick={() => setModal("about")}>
              Tentang Cek Dulu
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
          title="Tentang Cek Dulu"
          onClose={() => setModal(null)}
        >
          <p>
            Cek Dulu membantu investor ritel memahami klaim saham melalui bukti
            dan konteks. Dibuat untuk Sectors Hackathon 2026.
          </p>
          <p>
            Mode demo berisi ilustrasi offline. Pemeriksaan normal memerlukan konfigurasi server dan data cache yang tersedia.
          </p>
        </Modal>
      )}

    </div>
  );
}
