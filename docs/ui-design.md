# UI Cek Dulu: ruang pemeriksaan klaim

## Arah desain

`design.md` dari tim menjadi dasar warna, tipografi, dan hierarki produk. Arahnya
kuat: terminal riset keuangan dengan nuansa cyberpunk yang terkendali. Implementasi
memakai permukaan gelap, garis tipis, angka monospaced, dan aksen yang memiliki
fungsi. Komposisi asimetris tetap mengikuti urutan baca yang jelas.

Pengguna harus dapat memberikan klaim, memahami statusnya, lalu menelusuri bukti.
Hero dibuat pendek agar input segera terlihat. Panel contoh memakai fixture ADRO
dari shared dan diberi label demo serta tanggal fakta; tidak ada grafik, aktivitas
pasar, atau statistik pengguna buatan.

## Referensi

- [Koyfin](https://www.koyfin.com/): orientasi riset, pembandingan angka, dan akses ke data.
- [Full Fact](https://fullfact.org/): fokus penilaian pada klaim dan kejelasan sumber.
- [Anti AI Slop UI](https://github.com/rwcod/anti-ai-slop-ui): pedoman pemilihan arah
  visual, konsistensi token, dan penghindaran dekorasi generik. Sumber ini berupa
  panduan agen, bukan library komponen. Plugin dengan nama tersebut tidak ditemukan
  di katalog sesi; tidak ada plugin atau dependensi template baru yang dipasang.

Referensi digunakan untuk prinsip alur dan hierarki, bukan menyalin halaman.

## Sistem visual

- Token terpusat di `apps/web/styles/theme.css`.
- Oxanium untuk judul, Manrope untuk teks, IBM Plex Mono untuk angka dan metadata.
  Font dilayani lokal lewat `next/font/local`; lisensi OFL disertakan.
- Cyan untuk tindakan, lime untuk didukung, amber untuk menyesatkan, merah untuk
  dibantah, violet untuk belum dapat diverifikasi, abu-abu untuk di luar cakupan.
  Semua status juga memiliki ikon dan label, sehingga tidak bergantung pada warna.
- Tanpa gradien dekoratif, grafik palsu, glassmorphism berlapis, atau efek glow besar.
- Transisi singkat untuk interaksi; `prefers-reduced-motion` menonaktifkan animasi.

## Perubahan alur

1. Teks, screenshot, tautan video, dan unggahan video tetap memakai adapter yang sama.
   Instruksi file dan peninjauan transkripsi tetap terlihat.
2. Rapor menampilkan kutipan berdasarkan span teks bersih, penjelasan backend,
   konteks yang hilang, dan perbandingan angka. Tidak ada nilai pengganti buatan.
3. Tombol sumber membuka dialog dengan nilai, tanggal pengambilan, asal, dan periode
   bila tersedia. Parameter teknis disimpan dalam bagian yang dapat dibuka.
   Semua sumber dalam mode demo ditandai sebagai fixture.
4. Timeline memuat event SSE aktual. Tidak ada persentase progres atau tahapan
   sukses yang dikarang. Detail teknis dan penggunaan kredit tetap dapat dibuka.
5. Riwayat, simpan rapor, filter, panduan, dan disclaimer permanen dipertahankan.

## Responsif dan aksesibilitas

Desktop memakai input dan contoh berdampingan. Mobile memakai satu kolom, navigasi
yang dapat ditutup dengan Escape, dan panel sumber dari bawah. Navigasi tertutup
tidak dapat menerima fokus. Dialog sumber memakai dialog native untuk fokus modal
dan Escape; latar tidak ikut menggulir. Kontrol memiliki label, status mempunyai
ikon, dan fokus keyboard terlihat. Ukuran viewport 390 × 844 dan 1280 × 900
ditinjau; pemeriksaan browser juga memastikan tidak ada overflow horizontal mobile.

## Validasi dan batasnya

- Seluruh test Vitest, typecheck workspace, dan build produksi dijalankan.
- UI demo: ADRO → misleading, BBCA → supported, BBRI → out_of_scope, semuanya
  tanpa kredit Sectors. BBCA memakai angka sintetis berlabel dari fixture.
- Panel sumber, penutupan Escape, penyimpanan rapor, navigasi dan input media
  ditinjau melalui browser. Test kontrak menambahkan kutipan multi-klaim, normalisasi
  persen, sumber kosong, serta timeline yang hanya berisi event aktual.
- Ini validasi UI dan alur offline. Ketersediaan video platform, kualitas transkripsi,
  data pasar asli, dan konfigurasi deployment tidak dibuktikan oleh redesign ini.
- Belum dilakukan uji usability bersama pengguna atau audit screen reader menyeluruh;
  keputusan estetika tetap perlu ditinjau tim.

## Preview

- [Input desktop](ui-preview-desktop.jpg)
- [Rapor ADRO offline](ui-preview-report.jpg)
- [Panel sumber mobile](ui-preview-mobile.jpg)
