# Implementasi slate–biru

Pengguna menyetujui palet kedua dan melanjutkan sesudah review mobile. Susunan kerja berdampingan kini diterapkan pada desktop; mobile memakai satu kolom. Branch: feat/ui-investigation-console.

## Perubahan

Token warna diperbarui di theme.css. Aturan expressive.css lama diganti, tanpa menambah file CSS override baru. Font Barlow Semi Condensed weight 600 disimpan lokal dengan OFL, dipakai untuk judul dan angka; Source Sans 3 tetap untuk kontrol/isi. Logo asli mempertahankan mint–biru.

Desktop memakai navigasi horizontal dan form/preview berdampingan. Mobile memiliki logo serta menu, pilihan input dua kolom, dan tindakan membaca media/cek yang tetap memakai komponen serta state aplikasi yang ada. Tidak ada perubahan kontrak atau kode backend.

Rapor kini membaca status → kutipan → perbandingan angka → sumber/konteks → penjelasan lengkap. Penjelasan panjang tetap disclosure. Preview historis selalu memperlihatkan verdict dan kutipan meskipun pengguna berpindah tab. Grafik awal juga menunjukkan rata-rata mandiri sebagai ringkasan fixture; TTM diberi definisi periode berbeda.

## Validasi

- pnpm test: 775 test dalam 27 berkas lulus.
- pnpm -r typecheck: lulus.
- Browser desktop 1440 px; mobile 390 dan 360 px: halaman hasil, sumber, dan riwayat tidak overflow horizontal.
- Cek ADRO melalui UI dalam fixture offline: satu klaim, verdict misleading, delapan event trace. Panel sumber terbuka dan grafik tersedia; tombol tutup bekerja. Tidak menggunakan kredit API live.
- Tampilan link video memakai alur adapter yang sudah ada; test media menguji baca, retry, error, review, dan validasi berkas dengan mock. Pembacaan video asli tidak diuji di sesi desain.

Gambar implementasi disimpan di docs/design-mockups/exports dengan awalan implemented-. Gambar tersebut berasal dari aplikasi, berbeda dari mockup statis yang tetap tersedia pada port 3012.

Preview pengembangan memakai CHECK_FIXTURE_DEMO=1 dan SECTORS_MODE=cache_only pada proses terminal saja. Tidak mengubah .env.local. Fixture demo tidak aktif pada build produksi menurut guard yang sudah ada.
