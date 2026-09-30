# AGENTS.md: Cek Dulu

Konteks proyek untuk agen koding (Codex, Claude Code, dll). Baca seluruh file ini sebelum menulis kode. Kalau ada instruksi di file ini yang bertentangan dengan permintaan di chat, tanyakan dulu.

## 1. Apa yang kita bangun

**Cek Dulu** adalah agen AI yang memeriksa klaim saham Indonesia dari media sosial (TikTok, X, Telegram) terhadap data resmi dari Sectors API.

Alur: pengguna menempelkan teks, membagikan screenshot, atau menekan tombol di postingan X → agen memecah konten menjadi klaim atomik → setiap klaim diverifikasi dengan data Sectors → **Context Hunter** mencari konteks yang hilang → rapor per klaim dengan status, angka pembanding, konteks, dan sumber.

Nilai jual utama: status **"benar tapi menyesatkan"**, yaitu angka dalam klaim benar tetapi maknanya berubah karena konteks dihilangkan.

Lomba: Sectors Hackathon 2026, Track 1 (AI Agents & Assistants). Tim 4 orang. **Submit Rabu 30 Sep 2026 pukul 12:00 WIB.** Repo publik; begitu disubmit, repo beku total.

## 2. Aturan yang tidak boleh dilanggar

1. **LLM tidak pernah menghitung.** LLM hanya mengekstrak, memilih hipotesis, dan menulis penjelasan. Semua angka dihitung dan dibandingkan oleh kode TypeScript.
2. **Tidak ada angka tanpa evidence.** Setiap angka di penjelasan harus berasal dari objek `Evidence`. Ditegakkan oleh grounding validator di kode, bukan oleh prompt.
3. **Status verdict ditentukan oleh aturan kode** (adjudicator), bukan oleh LLM.
4. **Semua akses ke Sectors hanya lewat `packages/sectors`.** Jangan pernah `fetch` Sectors dari tempat lain. Modul itu yang mengurus cache, buku kredit, dan mode replay.
5. **Tidak ada nasihat investasi.** Dilarang menulis kata/frasa rekomendasi (beli, jual, hold, target harga, "layak dibeli", dsb.) di output produk. Disclaimer wajib tampil permanen.
6. **Link video adalah input isi konten, bukan hanya caption.** Server boleh mengambil video publik dari platform sosial melalui API resmi atau ekstraktor yang terawat untuk membaca audio dan frame. Jangan melewati login, paywall, DRM, atau pembatasan akses; jangan menerima URL internal/pribadi, kredensial dalam URL, atau unduhan tanpa batas ukuran/waktu. Tampilkan kegagalan platform secara jelas dan sediakan unggah video/screenshot/teks sebagai jalur cadangan. Media hanya diproses sementara, tidak disimpan dalam riwayat atau log; pengguna meninjau transkripsi sebelum cek. Jangan pernah mengklaim video sudah dibaca bila hanya caption yang tersedia.
7. **Sasaran pemeriksaan adalah klaim, bukan pembuat konten.** Jangan menyimpan atau menampilkan nama kreator sebagai subjek penilaian.
8. **Tidak ada rahasia di repo.** API key hanya di `.env.local` dan pengaturan Vercel. `.env*` ada di `.gitignore`. Jangan pernah menulis key di kode, test, fixture, atau log.
9. **Jangan mengarang nama endpoint atau field Sectors.** Kalau tidak yakin, cek dokumentasi (bagian 6) atau data cache yang sudah ada, lalu tulis TODO yang jelas. Jangan menebak.

## 3. Stack

- Monorepo (pnpm workspaces). Node 20+, TypeScript strict.
- `apps/web`: Next.js App Router, deploy Vercel. UI + route handler API. Streaming progres lewat Server-Sent Events.
- Supabase: Postgres (cache, buku kredit, checks, riwayat) + Auth.
- Zod untuk semua kontrak data antar-tahap.
- Vitest untuk unit test.
- LLM dengan structured output (JSON schema). Provider dan model dikonfigurasi lewat env (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`); jangan hardcode.
- `apps/extension`: Chrome Manifest V3 untuk X (prioritas paling rendah).

## 4. Struktur repo

```
cek-dulu/
├─ apps/
│  ├─ web/                 # Next.js: UI, PWA, API routes
│  │  ├─ app/api/check/    # POST: mulai cek, stream SSE
│  │  ├─ app/share/        # penerima Web Share Target
│  │  └─ public/manifest.webmanifest
│  └─ extension/           # Chrome MV3 untuk X
├─ packages/
│  ├─ shared/              # skema Zod, tipe, fixture (SUMBER KEBENARAN kontrak)
│  ├─ sectors/             # klien Sectors, cache, buku kredit, mode live/cache_only/replay
│  ├─ agent/               # normalizer, extractor, router, context hunter, adjudicator, grounding validator
│  └─ verifiers/           # verifier per tipe klaim (fungsi murni)
├─ eval/
│  ├─ testset.jsonl        # 40 kasus berlabel
│  ├─ run-eval.ts
│  └─ reports/             # hasil evaluasi, di-commit
├─ supabase/migrations/
└─ docs/
```

## 5. Pipeline

| # | Tahap | Masukan → keluaran | LLM? |
|---|---|---|---|
| 0 | Input adapter | teks / screenshot (OCR) / link video publik (audio + frame, caption bila ada) / berkas video pengguna → teks klaim mentah untuk ditinjau | transkripsi/OCR saja |
| 1 | Normalizer | teks → teks bersih + `Entity[]` (sebutan → ticker) | fallback saja |
| 2 | Claim extractor | teks → `Claim[]` bertipe | ya |
| 3 | Router | klaim → rencana panggilan tool + estimasi kredit | tidak |
| 4 | Verifier | rencana → `Evidence[]` + nilai terhitung + perbandingan | tidak |
| 5 | Context Hunter | klaim + evidence → hipotesis dipilih, diuji | pemilihan saja |
| 6 | Adjudicator | evidence + hasil hipotesis → `Verdict` | tidak (penjelasan saja) |
| 7 | Grounding validator | penjelasan → lolos / tolak | tidak |
| 8 | Trace emitter | tiap langkah → `TraceEvent` ke UI via SSE | tidak |

### Resolusi ticker (sumber kegagalan terbesar)
1. Pola eksplisit: `$ADRO`, `#BBRI`, atau 4 huruf kapital yang ada di daftar emiten.
2. Kamus alias (`ticker_aliases`): nama perusahaan, merek, grup, plesetan. Contoh: "Adaro" → ADRO (nama resmi sekarang Alamtri Resources Indonesia).
3. Fallback LLM dengan maksimal 10 kandidat dari fuzzy search. LLM hanya memilih dari kandidat.
4. Keyakinan < 0,7 → UI minta pengguna memilih. Jangan menebak.

### Context Hunter
Pustaka hipotesis per tipe klaim:
```ts
type Hypothesis = {
  id: string;                 // mis. 'DIV_ONE_OFF'
  claimType: ClaimType;
  description: string;        // untuk LLM: kapan relevan
  requiredTools: ToolCall[];
  estCredits: number;
  test: (claim: Claim, evidence: Evidence[]) => HypothesisResult; // DETERMINISTIK
};

// Nama metode yang sudah tersedia di packages/sectors, bukan URL endpoint.
type ToolCall = { tool: string; params: Record<string, unknown> };
```
LLM memilih & mengurutkan hipotesis → eksekutor menjalankan maks 3 hipotesis dan maks 8 kredit per klaim (hit cache = 0 kredit) → berhenti lebih awal bila satu hipotesis terpicu kuat.

### Status verdict (aturan adjudicator)
| Verdict | Syarat |
|---|---|
| `supported` | ≥1 evidence cocok dalam toleransi, tidak ada hipotesis konteks terpicu |
| `refuted` | nilai pembanding di luar toleransi |
| `misleading` | angka cocok, tetapi ≥1 hipotesis konteks terpicu dengan evidence |
| `unverifiable` | tidak ada evidence numerik / data kosong / periode belum dilaporkan |
| `out_of_scope` | prediksi atau opini ("bakal ke 10.000", "pasti cuan") |

### Grounding validator
Ekstrak semua angka dari penjelasan (format Indonesia: `1.358,18`, `25,5%`, `Rp2,4 T`, `miliar`, `triliun`), normalisasi (pembulatan, persen vs desimal, satuan), cocokkan dengan nilai di evidence. Gagal → tulis ulang sekali → gagal lagi → templat deterministik. **Wajib punya unit test.**

## 6. Sectors API

- Dokumentasi: https://docs.sectors.app (indeks untuk agen: https://docs.sectors.app/llms.txt). **v1 sudah mati (HTTP 410), pakai v2.**
- Auth: header `Authorization: <SECTORS_API_KEY>`. Base URL: verifikasi di dokumentasi sebelum dipakai, simpan di env `SECTORS_BASE_URL`.
- Halaman referensi v2 yang relevan (tambahkan `.md` untuk versi teks):
  - `/api-references/v2/indonesia/report/company-report` (sections: overview, valuation, financials, dividend, peers, …; minta hanya section yang perlu)
  - `/api-references/v2/indonesia/report/quarterly-financials`
  - `/api-references/v2/indonesia/helper-list/company-quarterly-dates`
  - `/api-references/v2/indonesia/transaction/daily` (harga + volume harian, maks 90 hari per panggilan)
  - `/api-references/v2/indonesia/brokers/foreign-flow-by-symbol` (maks 90 hari)
  - `/api-references/v2/indonesia/brokers/broker-summary-by-symbol` (jendela pendek, cek batasnya)
  - `/api-references/v2/indonesia/company/shareholders-composition` (bulanan)
  - `/api-references/v2/indonesia/screener/free-float`
  - `/api-references/v2/indonesia/company/corporate-actions`
  - `/api-references/v2/indonesia/ipo/listing-performance`
  - `/api-references/v2/indonesia/news/suspensions`
  - `/api-references/v2/indonesia/news/filings` (transaksi insider/pemegang saham besar, BUKAN keterbukaan informasi umum)
- **Tidak ada endpoint "daily-transaction" terpisah.** Likuiditas dihitung dari volume × harga di endpoint daily.

### Fakta data yang sudah diverifikasi dengan panggilan asli (23 Sep 2026)
- Quarterly financials = angka **per kuartal tersendiri, bukan kumulatif**.
- Field `earnings` = laba bersih yang diatribusikan ke pemilik entitas induk (EBT − pajak − minoritas).
- Field `yoy_quarter_earnings_growth` cocok dengan hitungan manual, **tapi jangan dipakai untuk kasus rugi → laba**; hitung sendiri dan tampilkan "berbalik dari rugi menjadi laba" (contoh: GOTO Q2 2025 rugi Rp296,7 M → Q2 2026 laba Rp349,5 M).
- Bank (mis. BBRI): `gross_profit`, `cost_of_revenue`, `total_debt` bernilai `null`; ada `financials_sector_metrics` (NII, gross loan, deposit). Klaim utang/margin kotor untuk bank → `unverifiable` atau definisi khusus.
- Ada nilai null dan anomali (mis. EBITDA tahunan TLKM 2022 = EBIT). Null → `unverifiable`, jangan diisi tebakan.
- Foreign flow: ada hari dengan semua nilai 0 (mis. TLKM 2 Sep 2026). Perlakukan sebagai data kosong, bukan "net 0".
- Shareholders composition: kolom `*_l` (lokal) dan `*_f` (asing) per kategori (individual, corporate, mutual_fund, …), plus `numbers_of_shareholders`. Ada bulan dengan jumlah pemegang saham sama persis dengan bulan sebelumnya (kemungkinan tidak diperbarui).
- **ADRO dividen** (kasus demo utama): `dividend_yield_avg.avg_yield` = 0,255 (25,5%) adalah field bawaan Sectors yang **tidak bisa direproduksi** dari rata-rata `total_yield` per tahun (2021–2025 ≈ 23,6%). Tampilkan sebagai "angka Sectors" DAN hitungan sendiri dengan rumus terlihat. Pembayaran 28 Nov 2024 Rp1.358,18 (yield 45,2%) terkait pemisahan AADI. `yield_ttm` = 0,0556, `cash_payout_ratio` = −0,897. **Belum ada data dividen ADRO tahun 2026**; sebelum menyimpulkan `DIV_TTM_GAP`, cek apakah ini data yang belum masuk (lihat corporate-actions).

### Kredit
1.000 kredit untuk seluruh tim. Kebanyakan endpoint 1 kredit per panggilan. Aturan:
- Development default memakai `SECTORS_MODE=cache_only`. Hanya jalankan `live` bila diminta eksplisit.
- Setiap panggilan dicatat di `credit_ledger` (endpoint, params, credits, cached, check_id, member).
- Klien menolak panggilan bila anggaran per cek atau per anggota terlampaui.
- Jangan menulis loop/test yang memanggil API live.

## 7. Kontrak data (ada di `packages/shared/src/schemas.ts`)

```ts
type ClaimType = 'valuation' | 'dividend' | 'price_move' | 'earnings_growth'
  | 'foreign_flow' | 'accumulation' | 'safety';
type Verdict = 'supported' | 'refuted' | 'misleading' | 'unverifiable' | 'out_of_scope';

type CheckInput = { checkId: string; userId?: string;
  source: 'paste' | 'share_target' | 'screenshot' | 'extension';
  rawText: string; url?: string; createdAt: string };

type Entity = { surface: string; ticker: string; confidence: number;
  method: 'explicit' | 'alias' | 'llm' | 'user' };

type Claim = { claimId: string; checkId: string; span: [number, number];
  type: ClaimType; ticker: string;
  asserted: { metric: string; value?: number; unit?: '%' | 'x' | 'IDR' | 'shares';
              window?: string; period?: string };
  inScope: boolean };

type Evidence = { evidenceId: string; claimId: string;
  tool: string; params: Record<string, unknown>;
  credits: number; cached: boolean; fetchedAt: string;
  label: string; value: number | string; unit?: string };

type HypothesisResult = { hypId: string; claimId: string; triggered: boolean;
  strength: 'weak' | 'strong'; evidenceIds: string[]; note: string };

type ClaimVerdict = { claimId: string; verdict: Verdict;
  computed?: { value: number; unit: string; evidenceId: string };
  missingContext: { hypId: string; summary: string; evidenceIds: string[] }[];
  explanation: string; evidenceIds: string[] };

type TraceEvent = { checkId: string; ts: string;
  stage: 'normalize' | 'extract' | 'route' | 'verify' | 'hunt' | 'adjudicate' | 'done' | 'error';
  message: string; data?: unknown; credits?: number };
```
Mengubah kontrak = ubah skema Zod + fixture + file ini dalam PR yang sama.

Kontrak tahap input tambahan: `InputAdaptation = { status: 'ready' | 'needs_text';
rawText: string; source: CheckSource; url?: string; warnings: string[] }`.
Skema `InputAdaptationSchema` membatasi teks 5000 karakter dan mewajibkan teks tidak
kosong untuk ready. Hasil OCR/caption ditinjau pengguna sebelum menjadi CheckInput.
Link memakai source paste dengan url; screenshot memakai source screenshot,
Web Share Target memakai source share_target. Tidak ada perubahan Claim atau Evidence.
Transkripsi video juga menghasilkan teks yang ditinjau pengguna sebelum menjadi CheckInput.
Link video memakai source paste dengan url sumber; asal video dicatat pada peringatan
input. Jika audio/frame tidak terbaca, jangan mengubah caption menjadi klaim video.

Fondasi shared juga mengekspor skema `ToolCall` dan `Hypothesis` (bagian 5).
`Hypothesis.test` adalah fungsi sinkron lokal yang divalidasi Zod, bukan payload JSON LLM.
Fixture kontrak ada di `packages/shared/fixtures/`; angka sintetis ditandai eksplisit.
Parser `parseNumber` / `extractNumbers` mengembalikan `raw` dan span UTF-16 `[awal, akhir)`.
`value` adalah angka sebelum skala, `normalized` mengubah persen ke pecahan dan skala ke
satuan dasar. Hasil ambigu memakai `ambiguous: true`, dengan `value` dan `normalized`
tidak terisi; pemanggil wajib memeriksa penanda tersebut sebelum memakai angka.
`parseIndonesianNumber` tetap tersedia sebagai pembantu skalar, mengembalikan `null`
untuk masukan invalid atau ambigu. Titik/koma tunggal dengan tiga digit di belakang
(misalnya `1.358` atau `1,358`) ambigu; `0.45` adalah desimal yang tidak ambigu.

## 8. Tipe klaim dan hipotesis

| Tipe | Contoh | Verifikasi | Hipotesis konteks |
|---|---|---|---|
| valuation (P0) | "PER cuma 3x" | PE/PB terbaru & historis, toleransi ±10% relatif | VAL_PEER_GAP (pakai median peer, bukan rata-rata; peer Sectors bisa berisi PE ekstrem/negatif), VAL_OWN_HISTORY, VAL_ONE_OFF_EARNINGS, VAL_NEG_PEG |
| dividend (P0) | "yield 25% setahun" | cocokkan ke yield TTM, rata-rata, per tahun; tentukan angka mana yang dirujuk | DIV_ONE_OFF, DIV_TTM_GAP, DIV_CASH_PAYOUT, DIV_SHARE_CHANGE |
| price_move (P0) | "sebulan naik 80%" | hitung perubahan harga pada jendela, toleransi ±3 poin persen | PRC_LOW_BASE, PRC_THIN_LIQ, PRC_LOW_FLOAT, PRC_SPLIT, PRC_WINDOW |
| earnings_growth (P1) | "laba meledak 200%" | YoY/QoQ dari quarterly | GRW_LOW_BASE (termasuk rugi→laba), GRW_REV_DIVERGE, GRW_ONE_OFF, GRW_PERIOD |
| foreign_flow (P1) | "asing lagi borong" | jumlah net foreign 5/20/60 hari atau jendela disebut | FGN_WINDOW, FGN_CATEGORY, FGN_SMALL |
| accumulation (P2) | "dikoleksi institusi" | perubahan kategori pemegang saham, konsentrasi broker | INS_THIN_FLOAT, INS_BROKER_CONC, INS_CATEGORY |
| safety (P2) | "aman kok, perusahaan gede" | sinyal risiko terukur saja | SAF_SUSPENSION, SAF_DILUTION, SAF_FLOAT_RULE. **Tidak pernah memberi `supported`** |

Margin: bedakan persen vs poin persentase. Rugi → laba: jangan paksakan angka persen.

## 9. Emiten demo (data ditarik sekali, lalu cache)
ADRO, BBRI, BBCA, BMRI, TLKM, ASII, BREN, GOTO, ANTM, PTBA, UNVR, ICBP, AMAR, CUAN, + 1 saham lapis bawah yang ramai.

## 10. Input
- **Tempel teks** (P0).
- **Screenshot** lewat upload atau Web Share Target (manifest `share_target` dengan `method: POST`, `enctype: multipart/form-data`, menerima `image/*`) → OCR via LLM vision. Ini jalur cadangan bila video tidak dapat diambil atau klaim hanya ada di satu frame.
- **Link video**: ambil caption lewat API resmi bila tersedia, lalu peroleh media publik melalui API/ekstraktor yang terawat dan transkripsikan ucapan serta tulisan pada frame memakai model multimodal. Berlaku lintas platform yang didukung ekstraktor; dukungan tiap situs dapat berubah. Jika video privat, dibatasi, terlalu besar, atau tidak dapat diambil, jelaskan alasannya dan arahkan pengguna ke unggah berkas video, screenshot, atau teks. URL tetap menjadi sumber. Jangan menyimpulkan klaim dari caption saja seolah-olah seluruh video sudah diperiksa.
- **Unggah video**: jalur cadangan untuk video yang dimiliki/diberikan pengguna. Validasi jenis dan ukuran berkas, proses sementara, dan minta peninjauan transkripsi. Untuk deployment serverless, batas unggah platform harus diperhatikan; gunakan penyimpanan sementara dengan akses terbatas untuk berkas besar.
- **Ekstensi X**: content script membaca teks postingan yang sedang dibuka pengguna.
- Web Share Target hanya jalan di Chrome Android; iOS memakai salin-tempel.

## 11. Konvensi kode
- TypeScript strict, tanpa `any` kecuali terpaksa dan diberi komentar.
- Verifier & fungsi `test` hipotesis = fungsi murni, tanpa I/O, mudah di-unit-test dengan fixture dari cache.
- Parser angka Indonesia di satu tempat (`packages/shared/src/number-id.ts`), dipakai extractor dan grounding validator.
- Semua output LLM divalidasi Zod; gagal validasi → retry sekali → error terkontrol.
- Nama file kebab-case, tipe PascalCase, fungsi camelCase. Kode & komentar boleh Inggris; teks UI Bahasa Indonesia.
- Fitur yang belum stabil dibungkus feature flag (`claim_types_ext`, `accounts`, `share_target`).
- Commit kecil: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. Kerja di branch `feat/<area>-<topik>`, lewat PR.

## 12. Perintah
```
pnpm install
pnpm dev                    # apps/web
pnpm test                   # vitest semua paket
pnpm check "<teks>"         # jalankan pipeline di CLI, output ClaimVerdict JSON
pnpm eval                   # eval/run-eval.ts dalam mode cache_only
```
Sebelum menyatakan tugas selesai: `pnpm test` dan `pnpm -r typecheck` harus lolos.

## 13. Prioritas pengerjaan
Tidak ada target harian; kerjakan secepat mungkin dengan kualitas setinggi mungkin, mengikuti urutan prioritas ini:
1. **P0:** pipeline inti end-to-end (normalizer → extractor → router → verifier → context hunter → adjudicator → grounding validator) untuk tipe valuation, dividend, price_move, dari UI sampai rapor.
2. **P1:** tipe earnings_growth dan foreign_flow; input screenshot; PWA.
3. **P2:** tipe accumulation dan safety; share target; akun & riwayat.
4. **P3:** ekstensi X.

Kualitas didahulukan dari jumlah fitur: fitur yang belum stabil dimatikan lewat feature flag, bukan dikirim setengah jadi. Batas mutlak: submit Rabu 30 Sep 2026, target pukul 12:00 WIB.

## 14. Disclaimer (tampil permanen di footer, ekstensi, README)
> Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi. Status klaim menilai kesesuaian klaim dengan data yang tersedia, bukan kelayakan membeli atau menjual saham. Data bersumber dari Sectors dan dapat tertinggal dari kondisi terkini. Lakukan riset sendiri sebelum mengambil keputusan.

## 15. Cara bekerja untuk agen
- Kerjakan satu tugas kecil per sesi; jangan merombak paket milik anggota lain tanpa diminta.
- Kalau butuh data Sectors yang belum ada di cache, **berhenti dan laporkan** panggilan apa yang dibutuhkan beserta perkiraan kredit.
- Kalau menemukan kontradiksi antara file ini dan kode, laporkan; jangan diam-diam memilih salah satu.
- Setiap fungsi baru di `verifiers/` dan `agent/` wajib disertai test.
