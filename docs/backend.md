# Backend dan Data — catatan serah terima (peran B)

Dokumen ini untuk A, C, dan D. Isinya apa yang sudah jadi di sisi data dan
backend, cara memakainya, dan hal-hal yang sengaja diputuskan berbeda dari
rencana beserta alasannya.

## Peta paket

| Lokasi | Isi | Pemilik |
|---|---|---|
| `packages/shared` | Skema Zod bab 5, claim_hash, parser angka Indonesia, resolusi ticker, kamus alias manual | A (ditulis B sebagai kontrak awal) |
| `packages/sectors` | Satu-satunya jalan ke Sectors API: klien bertipe, cache, buku kredit, anggaran, mode replay | B |
| `packages/verifiers` | Verifier tujuh tipe klaim | B |
| `apps/web/lib` | Pipeline dasar, persistensi, SSE, auth, flag, agregasi kredit, riwayat | B |
| `apps/web/app/api` | Route `/api/check`, `/api/history`, `/api/credits` | B |
| `apps/web/app/admin/credits` | Dasbor sisa kredit | B |
| `supabase/migrations` | Skema, RLS, view riwayat | B |
| `scripts` | Pemanasan cache, pengisian alias, laporan kredit harian | B |

## Cara menjalankan

```bash
npm install
cp .env.example .env.local        # isi kunci; jangan pernah di-commit

npm test                          # 129 uji, nol panggilan API
npm run typecheck
npm run dev                       # http://localhost:3000
```

Tanpa Supabase dan tanpa kunci Sectors, aplikasi tetap menyala: cache jatuh ke
berkas di `.cache/sectors`, buku kredit ke memori, kamus alias ke daftar manual
bawaan. Yang tidak jalan hanyalah riwayat, karena riwayat memang butuh akun.

### Menyiapkan basis data

Jalankan tiga migrasi di `supabase/migrations` berurutan lewat SQL editor
Supabase atau `supabase db push`.

### Memanaskan cache 15 emiten

```bash
npx tsx scripts/pull-demo-data.ts              # cetak estimasi kredit, tidak menarik apa pun
npx tsx scripts/pull-demo-data.ts --yes        # tarik data tipe 1-3  (~75 kredit)
npx tsx scripts/pull-demo-data.ts --full --yes # tambah tipe 4-7      (~210 kredit)
```

Skrip ini sengaja butuh `--yes`. Anggaran pos B hanya 250 kredit dan tidak bisa
diisi ulang; satu salah ketik tidak boleh menghabiskannya.

### Mengisi kamus alias

```bash
npx tsx scripts/seed-aliases.ts --fetch   # tarik daftar emiten (1 kredit), lalu isi tabel
```

### Laporan kredit pukul 21:00

```bash
npx tsx scripts/credit-report.ts          # keluarannya siap tempel ke chat tim
```

## Kontrak untuk A

Titik tukar pipeline ada di satu tempat: `apps/web/lib/pipeline/index.ts`.

```ts
export function createPipeline(opts: { aliases?: AliasEntry[] } = {}): Pipeline {
  return new BaselinePipeline(opts.aliases);   // <- ganti dengan AgentPipeline
}
```

Selama pipeline agen belum mendarat, route memakai `BaselinePipeline`:
normalizer dan ekstraktor berbasis aturan, **verifier sungguhan**, adjudicator
berbasis tabel bab 1.4. Jadi `/api/check` sudah memanggil data resmi dan
menghasilkan `ClaimVerdict` yang valid sejak sekarang — bukan fixture mati.
Yang masih milik A dan belum ada: ekstraktor LLM, pustaka hipotesis penuh,
pemilih hipotesis, dan penulis penjelasan.

Antarmuka yang harus dipenuhi `AgentPipeline` ada di
`apps/web/lib/pipeline/types.ts`. Route handler, persistensi, streaming, dan
buku kredit tidak perlu disentuh.

### Memakai verifier

```ts
import { getVerifier } from '@cek-dulu/verifiers';

const out = await getVerifier(claim.type)(claim, { client, checkId, today });
// out.evidence  — Evidence[] dengan evidenceId deterministik
// out.computed  — angka pembanding utama
// out.matches   — true | false | null (null = tidak bisa dinilai)
// out.details   — angka turunan untuk hipotesis, supaya tidak memanggil ulang
```

Verifier **tidak pernah** memutuskan verdict. Pemetaan ke status ada di
adjudicator. `out.details` sengaja disediakan supaya hipotesis Context Hunter
tidak perlu menembak endpoint yang sama dua kali — mis. `breakdownByYear` untuk
`DIV_ONE_OFF` sudah ikut di hasil verifier dividen.

## Kontrak untuk C

### `POST /api/check`

Badan permintaan:

```jsonc
{ "text": "…", "url": "https://…", "source": "paste|share_target|extension" }
```

Balasannya **Server-Sent Events**, bukan satu JSON:

| Event | Kapan | Muatan |
|---|---|---|
| `trace` | setiap tahap, berkali-kali | `TraceEvent` |
| `result` | sekali di akhir bila berhasil | `CheckResult` |
| `error` | sekali di akhir bila gagal | `{ checkId, message }` |
| `ping` | tiap 15 detik | `{ ts }` |

Header `X-Check-Id` berisi id cek sejak respons pertama, jadi UI bisa menautkan
ke riwayat sebelum cek selesai. Event `ping` ada supaya perantara tidak memutus
koneksi yang diam; abaikan saja di UI.

`GET /api/check` mengembalikan status kesehatan ringan untuk smoke test
integrasi harian.

### `GET /api/history`

Perlu `Authorization: Bearer <access token Supabase>`. Mengembalikan:

```jsonc
{
  "checks":  [{ "checkId", "excerpt", "counts": { "supported", "refuted", "misleading" }, "tickers", … }],
  "changes": [{ "claimHash", "ticker", "previousVerdict", "currentVerdict", "previousCheckedAt", … }]
}
```

`changes` adalah penanda "status berubah" di bab 1.3 nomor 5: klaim dengan
`claim_hash` sama yang verdict-nya berbeda dari pemeriksaan sebelumnya.

### `GET /api/history/:checkId`

Merakit ulang satu rapor lengkap dari riwayat — klaim, evidence, verdict,
hipotesis, dan jejak. Membuka riwayat tidak memakan satu kredit pun.

## Kontrak untuk D

Set uji berjalan di mode `cache_only`:

```bash
SECTORS_MODE=cache_only FLAG_CLAIM_TYPES_EXT=1 npx tsx eval/run-eval.ts
```

`FLAG_CLAIM_TYPES_EXT=1` menyalakan tipe 4-7 tanpa menyalakannya di produksi.
Di mode `cache_only`, panggilan yang belum ada di cache melempar `CACHE_MISS`
alih-alih diam-diam menembak API — jadi evaluasi tidak pernah membakar kredit.

Mode `replay` untuk rekaman video: jalankan sekali di `live` dengan
`SECTORS_RECORDING` terisi, lalu rekam demo di `replay`. Data yang diputar
benar-benar berasal dari panggilan live, tetapi demonya tidak bergantung pada
jaringan maupun sisa kredit.

## Keputusan yang berbeda dari rencana

**`claims.id` dan `evidence.id` bertipe `text`, bukan `uuid`.** Sketsa SQL bab
6.5 menulis uuid, tetapi kontrak Zod bab 5 mendefinisikan `claimId` dan
`evidenceId` sebagai string, dan verifier membangun `evidenceId` secara
deterministik (`<claimId>:<slug-label>`). Determinisme itu yang membuat laporan
evaluasi bisa dibandingkan antar-jalan dan grounding validator punya rujukan
stabil. Kontrak menang atas sketsa. `hypothesis_runs.evidence_ids` ikut menjadi
`text[]`.

**Route tidak mengembalikan fixture.** Bab 10 mengizinkan route mengembalikan
fixture sampai pipeline A siap. Membangun pipeline dasar yang memakai verifier
sungguhan ternyata lebih murah daripada membuat lalu membuang fixture, dan
efek sampingnya C bisa menguji UI terhadap bentuk data yang benar-benar akan
dikirim produksi.

**Kredit dipesan sebelum panggilan, bukan dicatat sesudahnya.** Satu panggilan
laporan delapan section menagih 8 kredit sekaligus. Kalau anggaran baru
diperiksa setelah respons datang, batas sudah telanjur terlewat. Karena itu
`CreditBudget.reserve` memakai estimasi di muka dan `settle` menyesuaikan ke
biaya sebenarnya setelah respons tiba.

**Free float disaring per subsektor.** Endpointnya menagih 1 kredit per 100
perusahaan dan hanya tersedia sebagai daftar. Menarik seluruh bursa untuk satu
emiten memakan ~10 kredit; disaring per subsektor menjadi ~2.

## Yang belum dikerjakan di sisi B

- `eval/run-eval.ts` dan `eval/testset.jsonl` — milik D.
- Autentikasi Supabase di sisi klien — milik C; sisi server sudah membaca token
  dari header `Authorization` maupun cookie sesi.
- Job latar sebagai cadangan bila `maxDuration` Vercel tidak cukup (bab 3.7).
  Belum dibutuhkan: `maxDuration` disetel 300 detik dan cek terlama di mode
  cache_only jauh di bawah itu. Kalau paket Vercel yang dipakai membatasi lebih
  rendah, jalurnya sudah disiapkan — `checks.status` sudah punya nilai
  `running`, jadi polling tinggal membaca tabel itu.
