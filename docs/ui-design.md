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
- Rapor mendahulukan status besar, indikator singkat dari tabel verdict, kartu
  konteks dengan angka evidence, dan dua batang pembanding. Tidak ada paragraf
  penjelasan di tampilan awal. Penjelasan asli tersedia sebagai poin bernomor
  dalam disclosure; angka dan isi penjelasan tidak ditulis ulang oleh LLM baru.
- Angka tampilan dibulatkan dua desimal. Nilai lengkap tetap dapat dibuka;
  pembulatan pada refuted menambah presisi bila dua angka akan terlihat sama.
  Grafik membandingkan satuan yang sama dan memakai sumbu nol, termasuk nilai
  negatif. Data kosong tidak ditampilkan sebagai nol.
- Panel sumber langsung membuka grafik SVG interaktif, termasuk ADRO tanpa
  metadata riwayat: yield rata-rata tercatat, rata-rata hitung ulang, pembayaran khusus,
  dan TTM dibandingkan sebagai definisi berbeda, bukan timeline buatan. Jika
  hanya pembanding tersedia, grafik klaim vs data tetap ditampilkan. Batang bisa
  disentuh/difokuskan untuk nilai lengkap. Status dan tombol tutup tetap terlihat
  saat panel digulir. Semua bukti dapat dicari dan diperiksa asal, nilai, serta rumusnya.
- Riwayat menjadi grafik hanya bila metadata metrik, saham, satuan, dan periode
  eksplisit cocok. Periode tahun dan tanggal dipisahkan; observasi bertentangan
  pada periode sama membatalkan grafik. Riwayat panjang dapat digulir.
- Label dan bantuan yang berulang pada input dihapus. Contoh di sisi form
  menggunakan grafik, bukan paragraf. Angka dalam transkripsi menjadi tombol
  navigasi ke span tepat di editor; ini alat tinjau, bukan tanda verifikasi.
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
Pilihan input mobile memiliki tinggi 48px, CTA baca 54px. Pada palet dasar,
kontras teks utama terhadap panel 14,90:1 dan teks bantuan 7,10:1.
ADRO menghasilkan misleading, BBCA supported (fixture sintetis), dan BBRI
out_of_scope melalui UI offline. Sumber, Escape/pengembalian fokus, simpan rapor,
serta pencarian riwayat diperiksa langsung.

Hasil akhir: pnpm test lulus 751 test di 27 file; pnpm -r typecheck dan build
produksi lulus. Dependensi Testing Library dan jsdom hanya dipakai untuk test.

Preview terisolasi memakai CHECK_UI_PREVIEW=1 dengan direktori .next-ui-preview,
agar tidak bertabrakan dengan kompilasi server development anggota lain.
Pengaturan default tetap .next. Mekanisme mengikuti
[distDir Next.js](https://nextjs.org/docs/pages/api-reference/config/next-config-js/distDir).

Validasi ini membuktikan UI dan alur mock/offline. Ketersediaan video platform,
akurasi transkripsi langsung, dan kelengkapan cache pasar tidak dibuktikan oleh
revisi tampilan. Belum ada uji usability bersama pengguna atau audit screen reader
menyeluruh; penilaian estetika perlu tetap ditinjau tim.

## Konsistensi dan aksen warna

Judul Periksa klaim saham, Riwayat pemeriksaan, Rapor tersimpan, dan panduan
memakai aturan tipografi yang sama: 28–36px sesuai lebar viewport, bobot 600,
line-height 1,25. Logo kembali memakai simbol mint bergradien dengan sedikit
kemiringan. Gradien putih–mint–lavender pada judul, mint–biru pada CTA, dan warna
transparan pada latar/kartu menambah kedalaman tanpa mengurangi keterbacaan.
Mode forced-colors kembali memakai warna sistem; reduced-motion tetap berlaku.
Ukuran ketiga judul diverifikasi di browser: 32px / line-height 40px pada
viewport 1280px, dan 28px / 35px pada viewport 390px, seluruhnya bobot 600.
Kontras endpoint gradien CTA terhadap teks gelap minimal 9,75:1; endpoint
gradien judul terhadap permukaan paling terang minimal 9,94:1.

Label grafik menyebut Rata-rata tercatat dan Rata-rata hitung ulang; identitas
Sectors tetap di bagian asal data, dokumentasi sumber, dan disclaimer. Bukti
asli dan perhitungan tidak diubah. Gradien hanya presentasi, bukan indikator status.

## Jika hasil pull masih menampilkan UI lama

UI ini diimpor langsung oleh halaman utama, tanpa feature flag. CHECK_UI_PREVIEW
hanya memilih direktori build, bukan desain. Service worker saat ini tidak
menyimpan HTML, CSS, atau respons API, sehingga bukan cache offline desain baru.

1. Pastikan checkout dan remote yang ditarik adalah feat/ui-investigation-console,
   lalu cocokkan commit terbaru dengan GitHub. Pull branch lain tidak memindahkan
   checkout secara otomatis.
2. Hentikan proses server lama pada mesin tersebut. Build ulang tidak mengganti
   proses next start yang sudah berjalan; proses itu perlu dijalankan ulang.
3. Jalankan instalasi dan build dari root repo. Build dan start harus memakai
   CHECK_UI_PREVIEW yang sama: default .next, atau preview .next-ui-preview.
4. Buka port yang tertulis di terminal server baru. Port 3000 dapat masih dilayani
   proses lama ketika proses baru berjalan pada 3001. Muat ulang penuh browser.
5. Halaman Tentang Cek Dulu (/about), bagian Informasi versi, menampilkan revisi Git yang dimasukkan saat build.
   Bandingkan nilai ini dengan commit lokal/remote. Nilainya adalah identitas sumber
   saat kompilasi, bukan klaim bahwa deployment selalu mengikuti branch terbaru.

Tanpa melihat checkout, revisi build, dan proses di mesin teman, penyebab spesifik
belum dapat disimpulkan. Repo dan preview lokal saja tidak membuktikan keadaan
mesin lain.

## Preview

- [Input desktop](ui-preview-desktop.jpg)
- [Tombol baca video](ui-preview-video.jpg)
- [Rapor ADRO offline](ui-preview-report.jpg)
- [Panel sumber mobile](ui-preview-mobile.jpg)
- [Ringkasan sumber desktop](ui-preview-sources.jpg)

## Halaman Tentang dan akses rapor terakhir

Tentang Cek Dulu menjadi route `/about` yang dapat dibuka langsung, dimuat ulang,
dan dibagikan. Satu tautan berada di sidebar (menu pada mobile); akses berulang
di header dan footer, status “Data tersimpan”, serta popup lama dihapus.
Disclaimer footer tetap ada. Navigasi dari halaman Tentang kembali ke cek,
riwayat, tersimpan, atau panduan melalui URL yang sesuai. Query tampilan tidak
valid kembali ke cek klaim; perubahan tampilan internal juga memperbarui URL
agar reload membuka tampilan yang sedang dilihat.

Halaman menggunakan alur visual tiga tahap, penjelasan singkat peran AI,
asal data, batas pemeriksaan, dan FAQ dengan disclosure native. Rincian versi
build tetap dapat dibuka untuk membandingkan hasil pull/build di mesin lain.
Halaman ini tidak meminta pemeriksaan AI dan tidak menghabiskan input Web Share
Target yang masih menunggu ditinjau.

Ruang kosong pada halaman cek diisi akses cepat ke rapor terakhir **hanya bila
riwayat lokal tersedia**. Teks berasal dari rapor yang ada; label contoh historis
dipertahankan. Membukanya tidak menjalankan cek baru. Tidak ada statistik,
aktivitas pasar, atau hasil pemeriksaan yang dibuat untuk dekorasi.

Ikon dan ilustrasi alur memakai dependensi Lucide yang sudah ada. Lisensi
[Lucide](https://lucide.dev/license) adalah ISC, dengan ikon turunan Feather
berlisensi MIT; pemberitahuan lisensi disertakan oleh paket. Asset raster baru
dan dependensi tambahan tidak diperlukan. Gradien lembut, logo mint, kontras,
aturan ukuran judul, reduced-motion, dan forced-colors yang ada dipertahankan.

Verifikasi: 770 test di 27 file dan typecheck lulus. Preview desktop 1280 × 900
serta mobile 390 × 844 diperiksa tanpa overflow horizontal. FAQ dapat dibuka
melalui keyboard, menu mobile memuat satu akses Tentang, dan rapor terakhir
membuka hasil historis yang sudah tersimpan. Pengujian ini tidak memakai API
Sectors live atau membuktikan kesiapan layanan eksternal di mesin lain.

## Footer

Footer memakai identitas produk yang sama dengan sidebar, copyright tahun
berjalan, serta atribusi Sectors yang mengarah ke dokumentasi sumber data.
Tidak ada akses Tentang tambahan, tautan kebijakan yang belum dibuat, atau
badge kepercayaan tanpa dasar. Garis pemisah beraksen mint dan jarak konsisten
menutup halaman tanpa bersaing dengan tombol pemeriksaan.

Seluruh kalimat disclaimer bagian 14 AGENTS.md tetap tampil permanen.
Pesan bukan nasihat investasi diberi bobot lebih kuat; kalimat tentang
kesesuaian klaim berada di kolom kiri dan keterbatasan data di kanan.
Pada ponsel, semuanya mengikuti satu kolom dengan pemisahan antarbagian.
Footer berada di luar main sebagai landmark contentinfo yang diberi nama;
ikon dekoratif tidak dibaca screen reader. Tautan sumber memiliki area sentuh
44px dan label aksesibel yang menyebut tab baru. Tidak ada teks disclaimer
yang disembunyikan dalam disclosure.

Verifikasi footer: 772 test / 27 file dan typecheck lulus, termasuk penjagaan
teks disclaimer lengkap serta satu akses Tentang pada halaman cek dan About.
Tampilan desktop 1280px dan ponsel 390px diperiksa tanpa overflow horizontal.
