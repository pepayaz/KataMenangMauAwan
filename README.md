# Cek Dulu

**Agen pemeriksa klaim saham di media sosial terhadap data resmi Sectors.**

Sectors Hackathon 2026 · Track 1 — AI Agents & Assistants

> Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi. Status
> klaim menilai kesesuaian klaim dengan data yang tersedia, bukan kelayakan
> membeli atau menjual saham. Data bersumber dari Sectors dan dapat tertinggal
> dari kondisi terkini. Lakukan riset sendiri sebelum mengambil keputusan.

---

## Masalah

Jumlah investor pasar modal Indonesia mencapai 30,30 juta SID per 7 Agustus
2026. Sebagian besar investor baru belajar dari TikTok, X, dan grup Telegram,
tempat klaim seperti "PER cuma 3x", "yield dividen 25%", atau "asing lagi
borong" beredar tanpa konteks. Memeriksa satu klaim butuh beberapa menit dan
akses ke data yang tidak dimiliki orang awam, sehingga hampir tidak pernah
dilakukan.

Cek Dulu membantu investor ritel Indonesia memeriksa klaim saham yang beredar di
media sosial, termasuk menemukan klaim yang benar secara angka tetapi
menyesatkan karena konteksnya dihilangkan.

## Contoh yang menjelaskan segalanya

> "Yield dividen ADRO 25% setahun, gila sih ini."

Field bawaan Sectors `dividend_yield_avg.avg_yield` bernilai 25,5%. Angka ini
tidak dapat direproduksi sebagai rata-rata yield tahunan: hitungan mandiri dari
2021–2025 sekitar 23,6%, sehingga keduanya perlu dibedakan.

Tetapi satu pembayaran luar biasa Rp1.358,18 pada 28 November 2024 menyumbang
yield 45,2% sendirian. Yield TTM pada data yang diverifikasi adalah 5,56%, dan
cash payout ratio −0,897. Belum ada data dividen ADRO 2026; angka historis ini
bukan kepastian pembayaran di masa depan.

Status: **benar tapi menyesatkan**.

## Status pengembangan

Repositori ini sedang dibangun selama periode hackathon 24–30 September 2026.

Sudah berjalan:

- Klien Sectors bertipe dengan cache Postgres, buku kredit, penegakan anggaran,
  dan tiga mode operasi (`live`, `cache_only`, `replay`)
- Verifier untuk tujuh tipe klaim
- `POST /api/check` dengan jejak agen yang mengalir lewat Server-Sent Events
- Riwayat cek dengan deteksi perubahan status berbasis `claim_hash`
- Skema Supabase lengkap dengan Row Level Security
- Pipeline agen lengkap, structured output, context hunter P0, grounding angka
  dan filter nasihat investasi
- Pilihan ticker pengguna yang divalidasi terhadap kandidat server
- Input screenshot melalui OCR vision dengan peninjauan teks, link video publik
  melalui ekstraktor yt-dlp dan Gemini untuk audio/frame, caption TikTok melalui
  oEmbed sebagai fallback yang diberi label, unggah video kecil, serta Web Share Target
- Antarmuka C terintegrasi di Next.js: streaming progres, rapor seluruh klaim,
  pilihan ticker, bookmark dan riwayat lokal; riwayat server memakai sesi Supabase
- Test otomatis memakai mock dan fixture tanpa API live

Belum tuntas: verifikasi integrasi memakai cache asli dan Supabase nyata,
sebagian hipotesis lanjutan (A), verifikasi PWA/share target di Android, ekstensi X dan set
evaluasi (D). Demo fixture diberi label jelas; angka demo bukan data pasar terkini.

## Menjalankan secara lokal

```bash
pnpm install
# Next berjalan dari apps/web; letakkan env lokal web di folder tersebut
cp .env.example apps/web/.env.local
# Isi LLM_PROVIDER, LLM_MODEL dan LLM_API_KEY untuk cek normal;
# pembacaan video membutuhkan provider Gemini
pnpm dev
```

Untuk menguji alur tanpa key atau cache:

```bash
pnpm dev:demo
```

Buka http://localhost:3000, centang **Demo fixture offline**, lalu pilih contoh
ADRO, BBCA atau BBRI. Server menjalankan pipeline sungguhan dengan mock offline;
demo mati di produksi. Desain berasal dari `frontend/`, aplikasi terintegrasi
berjalan dari `apps/web/`. Panduan dan batas verifikasi: [docs/integration.md](docs/integration.md).

Cache jatuh ke berkas dan buku kredit ke memori bila Supabase belum dikonfigurasi.
Cek normal memerlukan konfigurasi LLM dan cache data yang sesuai. Cache berkas default berada
di `.cache/sectors` pada root repo, sama untuk CLI dan web. Set `SECTORS_CACHE_DIR`
untuk memakai direktori cache B lain (sebaiknya absolut).
Mode web selalu `cache_only`; cache miss tidak mengambil data live.
Pemanasan cache adalah pekerjaan B dan membutuhkan izin eksplisit serta kredit;
perintah berikut hanya referensi, jangan dijalankan sebagai bagian test:

```bash
npx tsx scripts/pull-demo-data.ts --yes
```

Dokumentasi teknis backend: [`docs/backend.md`](docs/backend.md).
Konteks proyek untuk asisten koding: [`CLAUDE.md`](CLAUDE.md).

## Arsitektur singkat

```
teks mentah
  -> normalizer      kenali emiten (kode eksplisit, kamus alias, fallback LLM)
  -> extractor       pecah jadi klaim atomik bertipe
  -> router          petakan tipe klaim ke rencana panggilan, hitung kredit
  -> verifier        ambil data resmi, hitung angka pembanding        <- kode, bukan LLM
  -> context hunter  uji hipotesis "kenapa angka benar ini menyesatkan"
  -> adjudicator     tentukan status dari tabel aturan                <- kode, bukan LLM
  -> grounding       tolak penjelasan yang memuat angka di luar evidence
```

Tumpukan: Next.js App Router di Vercel, Supabase (Postgres + Auth), TypeScript,
Zod, Vitest.

## Lisensi dan atribusi

Data pasar bersumber dari [Sectors](https://sectors.app).

Panduan screenshot, caption video dan instalasi PWA: [docs/input-adapters.md](docs/input-adapters.md).
