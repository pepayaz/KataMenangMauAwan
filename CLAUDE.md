# Cek Dulu

Agen pemeriksa klaim saham di media sosial terhadap data resmi Sectors.
Sectors Hackathon 2026, Track 1 — AI Agents & Assistants.

Pengguna menempelkan atau membagikan konten saham dari media sosial; agen
memecahnya menjadi klaim, memverifikasi tiap klaim terhadap data Sectors, lalu
memburu konteks yang hilang. Nilai jual utamanya adalah status **"benar tapi
menyesatkan"**: angka yang cocok dengan data tetapi maknanya berubah begitu
konteksnya dikembalikan.

## Aturan yang tidak boleh dilanggar

1. **Tidak ada angka tanpa evidence.** Setiap angka di rapor wajib berasal dari
   baris `Evidence`. Aturan ini ditegakkan kode — adjudicator (`lib/pipeline/
   adjudicate.ts`) dan grounding validator — bukan oleh instruksi di prompt.
   Ini bagian yang juri periksa di repositori.
2. **LLM tidak pernah berhitung.** LLM mengekstrak, memilih hipotesis, dan
   menulis penjelasan. Kode TypeScript yang menghitung dan membandingkan.
3. **Sectors hanya lewat `packages/sectors`.** Tidak ada `fetch` ke
   `api.sectors.app` dari berkas lain mana pun.
4. **Bukan nasihat investasi.** Tidak ada rekomendasi beli atau jual dalam
   bentuk apa pun, termasuk ketika klaim dibantah. Tidak ada prediksi harga.
5. **Kunci API hanya di `.env.local` dan pengaturan Vercel.** Tidak pernah di
   repositori, tidak pernah di riwayat git.

## Kontrak data

`packages/shared/src/schemas.ts` adalah satu-satunya definisi `Claim`,
`Evidence`, `ClaimVerdict`, dan `TraceEvent`. Paket lain tidak boleh
mendefinisikan ulang tipe-tipe itu. Setiap perubahan kontrak wajib memperbarui
`packages/shared/CLAUDE.md` di PR yang sama.

## Pembagian peran

| Peran | Nama | Wilayah |
|---|---|---|
| A | Yuzuki Akmal | Extractor, router, Context Hunter, adjudicator, grounding validator, skema bersama |
| B | Naufal | Klien Sectors, cache, buku kredit, verifier, API dan streaming, Supabase |
| C | Faiz | Halaman cek, rapor, panel jejak, PWA, share target, riwayat |
| D | Awan | Ekstensi X, set uji 40 kasus, evaluasi, README, video, submission |

Setiap paket punya `CLAUDE.md` sendiri dengan aturan spesifiknya. Baca itu
sebelum menyentuh paketnya.

## Perintah

```bash
npm install
npm run dev          # Next.js di http://localhost:3000
npm test             # seluruh uji, nol panggilan API
npm run typecheck
npm run build

npx tsx scripts/pull-demo-data.ts       # estimasi kredit; --yes untuk menarik
npx tsx scripts/seed-aliases.ts --fetch # isi kamus ticker
npx tsx scripts/credit-report.ts        # laporan kredit harian
```

## Anggaran kredit

Total 1.000 kredit untuk seluruh tim, tidak bisa diisi ulang. Pembagian pos ada
di `packages/sectors/src/config.ts` dan sisanya terbaca di `/admin/credits`.
Mode `cache_only` adalah bawaan untuk pengembangan dan pengujian; ia tidak
pernah memanggil API.

## Konvensi

- Bahasa Indonesia untuk komentar, pesan commit, dan teks antarmuka.
- Nama metode klien Sectors mengikuti nama alat di dokumentasi resmi.
- Fungsi perhitungan ditulis murni dan diuji terpisah dari pengambilan data.
- Data yang tidak tersedia bukan kegagalan: kembalikan `unverifiable` dengan
  catatan, jangan menebak.
