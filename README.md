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

Angkanya benar. Rata-rata yield dividen ADRO lima tahun memang 25,5%.

Tetapi satu pembayaran luar biasa Rp1.358,18 pada 28 November 2024 menyumbang
yield 45,2% sendirian. Yield dua belas bulan terakhir — yang benar-benar
diterima pembeli hari ini — hanya 5,6%, dan cash payout ratio-nya −0,90.

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
- 129 uji unit yang berjalan tanpa satu pun panggilan API

Sedang dikerjakan: ekstraktor LLM dan pustaka hipotesis Context Hunter (A),
antarmuka dan PWA (C), ekstensi X dan set evaluasi (D).

## Menjalankan secara lokal

```bash
npm install
cp .env.example .env.local
npm run dev
```

Aplikasi menyala tanpa kunci Sectors maupun Supabase — cache jatuh ke berkas dan
buku kredit ke memori. Untuk memakai data sungguhan, isi `SECTORS_API_KEY`,
jalankan migrasi di `supabase/migrations`, lalu panaskan cache:

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
