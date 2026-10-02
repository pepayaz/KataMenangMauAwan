# Integrasi landing ke aplikasi

Landing disetujui pengguna untuk integrasi setelah revisi kontrol panah pada sisi kartu, gerak otomatis dan penghapusan CTA duplikat.

## Perubahan

`/` memuat landing React; `/check` memuat workspace pemeriksaan. Tautan lama dengan view riwayat, tersimpan atau panduan dialihkan ke `/check?view=...`. Logo workspace menuju beranda. Halaman Tentang mengarah ke checker dan panduan pada URL baru. Semua tautan internal produk relatif sehingga bekerja pada domain deployment yang berbeda.

Route `/share` dan HTML handoff input harus diubah: input sessionStorage perlu langsung dibuka oleh checker, bukan berhenti di landing. Payload, validasi, CSP dan feature flag tetap mengikuti implementasi sebelumnya. Tidak mengubah kode paket Sectors/verifier atau kontrak backend SSE.

PWA tetap mulai di `/` dengan scope `/`; share_target tetap `/share`. Service worker tidak menyimpan halaman/API, jadi tidak membutuhkan invalidasi cache UI.

Landing memakai footer dan font lokal aplikasi. CSS dibatasi pada `.landing` agar tidak memengaruhi halaman pemeriksaan. Contoh ADRO mengambil angka dari evidence fixture shared, ditandai sebagai historis; animasi tidak membuat data atau perhitungan verdict baru. Semua listener/observer/timer React dibersihkan saat komponen dilepas.

## Validasi

- pnpm test: 783 test dalam 28 berkas lolos.
- pnpm -r typecheck: lolos.
- pnpm --filter @cek-dulu/web build: lolos, termasuk route `/` dan `/check`.
- UI development: landing → checker → demo ADRO menghasilkan misleading, delapan bukti dan delapan trace event; grafik sumber dibuka dan rapor disimpan. Koleksi tersimpan tetap terbaca setelah navigasi penuh.
- Deep link lama `/?view=history` dialihkan ke `/check?view=history` di browser.
- UI production pada 390 px: konten 375 px, panah berada pada x=8–48 dan x=327–367; tidak overflow horizontal.
- Cek normal ADRO pada build produksi (LLM terkonfigurasi, Sectors cache_only, bukan fixture demo) berhasil: satu klaim, misleading, 35 bukti dan delapan event trace. Dialog sumber menampilkan grafik serta daftar 35 bukti dan dapat ditutup. Tidak memakai panggilan Sectors live.
- Kontrol panah, pergantian otomatis, fokus keyboard, reduced motion dan handoff share diuji dengan test. Jalur input media memakai mock pada suite yang ada; video/screenshot asli tidak diuji ulang dalam perubahan landing ini.

Gambar aplikasi terintegrasi tersedia pada `docs/design-mockups/exports/integrated-landing-desktop.png` dan `integrated-landing-mobile.png`.

## Kondisi lingkungan

Pemeriksaan normal pertama di proses sandbox gagal: koneksi eksternal mendapat EACCES. Server lokal dimulai ulang dengan akses jaringan yang diotorisasi, Sectors tetap cache_only. Tidak mengubah `.env.local` atau memakai API Sectors live. Guard fixture demo tetap tidak aktif di build produksi.

Sesudah akses jaringan tersedia, cek normal di build produksi berhasil. Server lokal tersedia di http://localhost:3001/; port 3013 hanya arsip preview. Screenshot/video asli dan sinkronisasi akun Supabase tidak diklaim teruji end-to-end dalam tugas landing ini; jalur input media dan persistensi tetap menggunakan implementasi yang ada.
