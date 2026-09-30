# Revisi UI Cek Dulu

## Dasar keputusan

Arah gelap dan aksen cyan dari design.md dipertahankan. Koreksi tim mengubah
penekanannya: antarmuka riset yang tenang, bukan terminal futuristis atau halaman
promosi. Judul menjelaskan tugas, teks bantuan menjelaskan tindakan berikutnya.

Dalam audit ini, “AI slop” berarti elemen yang terasa seperti template tanpa
alasan produk: slogan berulang, label teknis dekoratif, tipografi yang menghambat
pembacaan, dan CTA yang tidak mengikuti urutan kerja. Warna gelap, kartu, dan
animasi tidak otomatis termasuk slop; masing-masing harus punya fungsi.

Aturan [anti-slop](https://github.com/miqdadbadjuber/anti-slop) digunakan sebagai
rujukan audit, bukan installer atau library komponen. Panduan dibaca tanpa
menjalankan skripnya atau menambahkan instruksi ke AGENTS.md.

## Referensi

- [Koyfin dashboards](https://www.koyfin.com/features/my-dashboards/): navigasi
  sederhana dan hierarki informasi riset. Aplikasi publiknya ditinjau secara visual.
- [Quartr AI chat](https://quartr.com/features/ai-chat): teks yang terbaca,
  panel riset, dan akses sumber. Halaman ditinjau secara visual.
- [Source Sans 3](https://github.com/adobe-fonts/source-sans): keluarga font untuk
  antarmuka. Font dilayani lokal, dengan lisensi OFL disertakan.

Referensi memberi prinsip, bukan salinan layout atau klaim pemasaran.

## Yang berubah dan alasannya

- Semua slogan yang ditandai tim dihapus, termasuk hero, rail tiga langkah,
  catatan sidebar, motto footer, serta judul promosi pada panduan dan riwayat.
- Source Sans 3 menggantikan Oxanium, Manrope, dan font mono. Angka memakai
  bentuk tabular agar pembandingan tetap rapi; teks utama 16px.
- Charcoal dan cyan lembut mengurangi intensitas visual. Warna status tetap
  disertai ikon dan teks, tidak menjadi satu-satunya pembeda.
- Pilihan input berupa kontrol bersegmen dengan ikon yang sesuai. Pada media,
  tombol baca menjadi CTA penuh selebar panel. Editor dan tombol cek muncul
  setelah pembacaan menghasilkan teks atau meminta fallback teks manual.
- Perubahan link/berkas membatalkan kesiapan hasil lama. Saat membaca, mode dan
  cek dikunci. Gagal membaca tetap menawarkan percobaan ulang dan alasan.
- Mengubah input menyembunyikan rapor lama agar tidak tertukar dengan klaim baru.
  Cek selesai mengarahkan fokus ke hasil; drawer mengembalikan fokus ke pemicunya.
- Upload mendukung pemilih berkas dan drag-drop. Batas tipe, ukuran, satu berkas,
  serta keterangan pemrosesan tetap tersedia.
- Rapor, sumber, dan trace menampilkan informasi terbaca, tanpa blok JSON.
  Kutipan, evidence, rumus yang tersedia, periode, dan kredit tidak dikarang.
- Input media menunjukkan tiga tahap kerja nyata: baca, tinjau, lalu periksa.
  Setelah pembacaan, pengaturan sumber disusutkan. Pengguna tetap bisa mengganti
  berkas/link atau membaca ulang; perubahan sumber membatalkan teks lama.
- Tautan sumber ditampilkan sebagai domain. Pengingat untuk meninjau saham dan
  angka selalu terlihat; seluruh catatan pembacaan tersedia dalam disclosure.
  Pembacaan tidak lengkap ditandai terbuka, dan contoh teks disembunyikan saat
  pengguna sedang meninjau media agar tidak bersaing dengan tindakan utama.
- Rapor mendahulukan status besar, alasan singkat dari tabel verdict, konteks
  backend, dan dua batang pembanding. Penjelasan asli tersedia per kalimat dalam
  disclosure; angka dan isi penjelasan tidak ditulis ulang oleh UI atau LLM baru.
- Angka tampilan dibulatkan dua desimal. Nilai lengkap tetap dapat dibuka;
  pembulatan pada refuted menambah presisi bila dua angka akan terlihat sama.
  Grafik membandingkan satuan yang sama dan memakai sumbu nol, termasuk nilai
  negatif. Data kosong tidak ditampilkan sebagai nol.
- Panel sumber memiliki ringkasan bukti yang mendasari computed/konteks, serta
  semua sumber dengan pencarian dan rincian nilai, waktu, asal, serta rumus.
  Riwayat menjadi grafik hanya bila metadata metrik, saham, satuan, dan periode
  eksplisit cocok. Periode tahun dan tanggal dipisahkan; observasi bertentangan
  pada periode sama membatalkan grafik. Riwayat panjang dapat digulir.
- Gerak dipakai untuk pergantian panel, status membaca, hasil baru, dan drawer.
  prefers-reduced-motion menonaktifkannya. Tidak ada efek glow atau animasi latar.

Pilihan intensitas dari toolkit anti-slop: ENERGY 1, RHYTHM 2, MOTION 2.
Ritme berasal dari form, panel contoh, rapor perbandingan, dan daftar riwayat yang
memiliki bentuk berbeda sesuai fungsi.

## Audit dan verifikasi

- **Hard constraints:** tindakan memiliki handler nyata; fixture diberi label
  historis; tanpa statistik buatan; sumber dan disclaimer permanen dipertahankan.
- **Purpose:** pilih input → baca media → tinjau/koreksi → cek → baca hasil/sumber.
  Tombol baca dominan sebelum transkripsi, lalu tombol cek mengambil prioritas.
- **Liveliness:** hover, fokus, perubahan mode, indikator membaca, toast simpan,
  dan drawer merespons tindakan nyata. Tidak ada progres persentase palsu.
- **Craft:** desktop dan mobile ditinjau; pemeriksaan overflow, fokus, Escape,
  ukuran kontrol, dan kontras tercatat bersama preview. Pengujian interaksi
  memakai jaringan mock, termasuk teks lama, fallback, error, dan batas unggahan.

Viewport 1280 × 900 dan 390 × 844 diperiksa tanpa overflow horizontal.
Pilihan input mobile memiliki tinggi 48px, CTA baca 54px. Kontras teks utama
terhadap panel 14,90:1, teks bantuan 7,10:1, dan teks CTA 10,62:1.
ADRO menghasilkan misleading, BBCA supported (fixture sintetis), dan BBRI
out_of_scope melalui UI offline. Sumber, Escape/pengembalian fokus, simpan rapor,
serta pencarian riwayat diperiksa langsung.

Hasil akhir: pnpm test lulus 745 test di 27 file; pnpm -r typecheck dan build
produksi lulus. Dependensi Testing Library dan jsdom hanya dipakai untuk test.

Preview terisolasi memakai CHECK_UI_PREVIEW=1 dengan direktori .next-ui-preview,
agar tidak bertabrakan dengan kompilasi server development anggota lain.
Pengaturan default tetap .next. Mekanisme mengikuti
[distDir Next.js](https://nextjs.org/docs/pages/api-reference/config/next-config-js/distDir).

Validasi ini membuktikan UI dan alur mock/offline. Ketersediaan video platform,
akurasi transkripsi langsung, dan kelengkapan cache pasar tidak dibuktikan oleh
revisi tampilan. Belum ada uji usability bersama pengguna atau audit screen reader
menyeluruh; penilaian estetika perlu tetap ditinjau tim.

## Preview

- [Input desktop](ui-preview-desktop.jpg)
- [Tombol baca video](ui-preview-video.jpg)
- [Rapor ADRO offline](ui-preview-report.jpg)
- [Panel sumber mobile](ui-preview-mobile.jpg)
- [Ringkasan sumber desktop](ui-preview-sources.jpg)
