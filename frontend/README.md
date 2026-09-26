# Cek Dulu — Frontend

Frontend mandiri dengan React, TypeScript, dan Vite. Semua kode berada di folder ini dan belum terintegrasi dengan backend, Sectors, atau LLM.

## Jalankan

```powershell
cd frontend
npm install
npm run dev
```

Buka URL yang ditampilkan Vite (biasanya `http://localhost:5173`).

```powershell
npm run build
npm run preview
```

## Alur demo

- Pilih ADRO, BBCA, atau TLKM untuk mengisi teks contoh, lalu tekan **Cek klaim ini**.
- Lihat simulasi progres, rapor, perbandingan angka, temuan konteks, dan dialog catatan bukti.
- Teks di luar contoh menghasilkan **Tidak bisa diverifikasi**, bukan hasil pemeriksaan palsu.
- Buka **Riwayat cek** untuk mencari atau menyaring rapor. Tombol bookmark menambahkan rapor ke **Tersimpan**.
- Riwayat disimpan di localStorage browser (maksimal 50 rapor terbaru); tidak dikirim ke server.
- Halaman **Cara kerja** menjelaskan alur dan arti status. Menu pada layar kecil dapat dibuka melalui tombol hamburger.

## Struktur

- `src/App.tsx`: antarmuka, navigasi, alur simulasi, dan penyimpanan lokal.
- `src/demo.ts`: fixture ilustrasi dan validasi riwayat lokal; bukan kontrak API backend.
- `src/styles.css`: desain responsif, animasi, serta dukungan reduced motion.
- `src/theme.css`: palet Midnight Signal, panel gelap, aksen neon cyan/violet, dan efek glow.

Angka ADRO mengikuti ilustrasi dokumen proyek. Angka BBCA dan TLKM sintetis untuk demonstrasi UI, bukan data pasar. Semua hasil diberi label demo. Tidak memerlukan `.env` atau API key.

Font Manrope dan DM Sans dimuat dari Google Fonts; jika offline, browser memakai sans-serif bawaan. Ikon berasal dari `lucide-react` dan ilustrasi hero dibuat dengan CSS/SVG lokal.


## Aplikasi terintegrasi

Desain ini sudah dipindahkan ke Next.js di `apps/web` pada branch
`feat/integration-core`, terhubung ke pipeline backend melalui POST/SSE.
Jalankan `pnpm dev:demo` dari root repo untuk demo offline yang diberi label,
atau `pnpm dev` dengan konfigurasi LLM dan cache Sectors untuk pemeriksaan normal.
Panduan: [docs/integration.md](../docs/integration.md). Aplikasi Vite dalam
folder ini adalah referensi desain awal dan masih memakai simulasi demo.
