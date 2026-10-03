# DESIGN — Cek Dulu

Status: Fase 3 disetujui pengguna melalui pesan “lanjut”. Fase 2 disetujui melalui pesan “setuju, lanjutkan”. Nilai di bagian spesifikasi adalah aturan untuk mockup berikutnya, bukan klaim bahwa sudah diterapkan pada produk. Spesifikasi lama tersimpan utuh di `docs/design-legacy-before-guided-redesign.md`.

## Arah visual

Ruang pemeriksaan klaim saham dengan kutipan yang ditandai, angka yang dapat dibandingkan, dan lapisan bukti yang dibuka pengguna; permukaan gelap solid, warna terarah, tanpa kaca.

Sumber isi: KONTEN.md. Referensi terpilih: Ground News untuk perbandingan, Quartr untuk kutipan–sumber, Codrops 3D Stack Motion untuk gerak lapisan. Bentuk layout final belum dipilih; Fase 4 akan membandingkan alternatif.

## Pengukuran referensi — fakta teramati

Diukur 2 Oktober 2026 lewat computed style browser, viewport 1280 × 720. Design Inspiration MCP gagal dengan `spawn dembrandt ENOENT`; tidak ada instalasi. Nilai berikut adalah sampel elemen pada halaman tertentu, bukan keseluruhan design system. Tidak ada pengukuran mobile pada fase ini.

| Atribut | Quartr /features/transcript-search | Ground News /blindspot | Codrops /Development/3DStackMotion/ |
|---|---|---|---|
| Font | InterVariable/Inter | universalSans | Kode Mono |
| Judul | H1 38 px, weight 550, line-height 41,8 px | Judul kelompok 32 px, weight 600, line-height 35 px | Judul pengantar H2 89,6 px, weight 400 |
| Judul bagian/item | H2 24 px, weight 550, line-height 26,4 px | Judul berita 22 px, weight 800, line-height 27,5 px | Judul kartu sekitar 10,53 px |
| Isi | Paragraf utama 17 px, weight 450, line-height 23,8 px; body 16/24 px | Body 16/24 px | Pengantar 18 px; body 12 px; kartu 9 px |
| Rasio judul/isi sampel | 38/17 ≈ 2,24 | 32/16 = 2 | 89,6/18 ≈ 4,98; tidak cocok untuk aplikasi |
| Jarak terukur | Margin atas H2 48 px; gap wadah utama 16 px | Gap kartu 8 px | Padding kartu 5 px |
| Lebar terukur | Kolom isi 640 px; bukan max-width global | Kolom kelompok 567,5 px; kartu 267,75 px; bukan max-width global | Kartu max-width 255 px |
| Radius terukur | Wadah teks 0 px; radius gambar belum diukur | Anchor kartu 0 px | Kartu 10 px, bidang gambar 6 px |
| Warna | Body `oklch(0.143 0.004 263.509)`; teks `oklch(0.993 0.001 197.146)`; paragraf `oklch(0.869 0.004 236.509)` | Latar rgb(238,239,233), teks rgb(38,38,38) | Latar #000000, teks #FFFFFF; permukaan kartu rgba(255,255,255,0.2) |

Tautan pengukuran: [Quartr](https://quartr.com/features/transcript-search), [Ground News](https://ground.news/blindspot), [Codrops](https://tympanus.net/Development/3DStackMotion/). Cuplikan referensi tersedia di REFERENSI.md.

Yang diadaptasi: rasio judul/isi sekitar 2,2; skala bagian 24 px; jeda 48 px; kelompok perbandingan yang jelas; gagasan lapisan. Yang tidak diambil: font proprietary Ground News, konten/foto demo Codrops, teks 9–12 px, transparansi kartu, scroll wajib, dan judul demo yang sangat besar.

## Palet terpilih — slate–biru

Pengguna memilih alternatif palet kedua melalui pesan “saya pilih yang kedua, lanjut”. Pilihan ini mengesahkan warna, bukan otomatis memilih alternatif layout. Dasar dan hasil uji kontras ada di docs/design-palettes.md.

| Nama | Hex | Peran |
|---|---|---|
| Grafit | #111113 | Latar utama |
| Slate | #212225 | Permukaan form dan hasil |
| Putih netral | #EDEEF0 | Teks utama, angka, judul |
| Abu teks | #B0B4BA | Teks sekunder |
| Biru aksi | #3B9EFF | Aksi utama, penanda pilihan aktif |
| Amber status | #E5BA83 | Konteks yang hilang dan status misleading |

Token pendukung: garis pasif #363A3F, batas kontrol #777B84, tint latar #1B263A, pilihan aktif #19304B, grafik pembanding #698DB2, batang klaim #777B84. Logo asli mempertahankan mint #72D6C5 dan biru #9AAFF2; warna logo tidak disebarkan ke angka/grafik. Jangan menurunkan opacity seluruh blok teks. Target kontras teks minimal 4,5:1 dan batas/fokus penting 3:1; validasi setiap state pada implementasi.

Status: supported memakai ikon centang/toska; misleading ikon peringatan/amber; refuted ikon silang, kata “Dibantah” dan teks terang; unverifiable ikon data kosong dan label; out_of_scope ikon batas cakupan dan label. Warna tidak membedakan status sendirian. Tidak menggunakan hijau sebagai tanda peluang investasi.

Gradien dibatasi: tombol #3B9EFF → #70B8FF dengan teks #0D1520; latar #1B263A → #111113 hanya pada area atas; panel input #212225 → #111113 untuk kedalaman. Bidang hasil solid. Jangan memakai teks gradien untuk verdict, isi, angka bukti, atau judul. Grafik memakai fill solid. Tidak ada glow neon, backdrop blur, atau panel transparan.

## Tipografi usulan

Dua keluarga: **Barlow Semi Condensed** untuk judul utama/angka pembanding dan **Source Sans 3** untuk isi, kontrol, tabel, serta label. Barlow dipilih karena bentuknya lebih sempit dan jelas berbeda dari font isi; bukan karena font tersebut dipakai oleh referensi. Kedua font sudah tersedia lokal dalam artefak mockup beserta lisensi, belum diterapkan ke produk lewat revisi ini.

Sumber Barlow: [direktori Google Fonts beserta OFL.txt](https://github.com/google/fonts/tree/main/ofl/barlowsemicondensed). Saat implementasi yang disetujui, ambil hanya weight 600/700 yang perlu, simpan lokal beserta lisensi; tanpa permintaan font ke pihak ketiga saat halaman digunakan. Jika tidak tersedia, fallback Source Sans 3. Logo tidak diubah mengikuti font judul.

| Peran | Desktop | Mobile | Weight | Line-height |
|---|---|---|---|---|
| Judul layar | 38 px | 30 px | 600 | 1,15 |
| Judul bagian | 24 px | 22 px | 600 | 1,25 |
| Kutipan klaim | 22 px | 20 px | 600 | 1,4 |
| Angka pembanding utama | 30 px | 28 px | 600 | 1,1 |
| Isi/penjelasan | 17 px | 16 px | 400 | 1,55 |
| Tombol dan field | 16 px | 16 px | 600/400 | 1,4 |
| Label/detail sumber | 14 px | 14 px | 400/600 | 1,5 |

“Periksa klaim saham”, “Riwayat pemeriksaan”, “Rapor tersimpan”, “Tentang Cek Dulu” memakai token judul layar yang sama. Angka memakai tabular numerals bila tersedia, tetap format Indonesia. Tidak ada family monospace tambahan, weight 900, uppercase kecil sebagai pembuka setiap bagian, atau text kurang dari 14 px.

## Tata letak dan ritme

- Lebar maksimum halaman 1200 px. Kolom bacaan panjang maksimal 640 px/sekitar 65 karakter per baris.
- Grid desktop 12 kolom, gap 24 px. Tablet 8 kolom, gap 20 px. Mobile 4 kolom konseptual, gap 16 px; isi rapor satu kolom.
- Breakpoint: mobile sampai 767 px; tablet 768–1023 px; desktop mulai 1024 px. Harus tetap berfungsi pada lebar 360 px.
- Gutter halaman: 32 px desktop, 24 px tablet, 16 px mobile. Jarak bagian: 48 px desktop, 32 px mobile.
- Skala ruang: 4, 8, 12, 16, 24, 32, 48, 64 px. Jarak label–field 8 px; antarkontrol terkait 12 px; antarkelompok 24 px.
- Padding panel 24 px desktop/16 px mobile. Radius: field/tombol 8 px; panel 12 px; chip 6 px; tidak semua benda berbentuk pil.
- Perataan kiri untuk input, kutipan dan penjelasan. Angka sejajar menurut peran; jangan memusatkan semua bagian.
- Teks panjang tidak dipersempit menjadi kolom kecil hanya untuk memenuhi grid. Dialog sumber pada HP dapat menjadi layar penuh, tetap punya tombol tutup, focus trap, dan kembali ke pemicu.

## Komponen inti

### Tombol, tautan, navigasi

- Tinggi kontrol utama 48 px, area sentuh minimal 44 × 44 px. Ikon 20 px; jarak ikon–label 8 px.
- Satu aksi dominan per tahap: baca media, lalu cek klaim. Tombol baca harus menonjol sebelum transkripsi siap, bukan menjadi tautan kecil.
- Tombol utama memakai gradien biru dengan teks #0D1520; sekunder bidang solid dengan garis. Disabled memakai #303C4B dengan teks #B0B4BA dan batas #777B84. Disabled tetap terbaca dan dibedakan lewat keadaan/penjelasan, bukan opacity 30%.
- Tautan isi bergaris bawah; fokus 2 px biru pembanding, offset 3 px. Navigasi aktif memakai label + penanda, bukan warna saja.
- Loading memuat label tindakan dan indikator; cegah klik ganda. Tidak menggeser layout ketika label berubah.

### Input dan peninjauan media

- Pilihan mode memakai ikon + label. Setelah memilih, tampilkan satu field utama dan satu tindakan berikutnya; bantuan rinci dalam disclosure dengan judul jelas.
- Preview berkas berupa nama/jenis/ukuran atau thumbnail gambar bila tersedia; jangan membuat frame video palsu.
- Transkripsi tetap editable. Penanda angka memilih span teks, tidak diberi simbol verifikasi sebelum pemeriksaan.
- Warning relevan ditampilkan sebelum “Cek klaim ini”; jangan menaruh semua warning dalam tooltip atau menghapusnya untuk mempersingkat UI.
- Pesan error menempel pada input terkait, menyebut tindakan pemulihan. Jangan menyebut semua kegagalan sebagai konfigurasi OCR.

### Rapor dan sumber

- Urutan baca: status + kutipan → pembanding → konteks → sumber → penjelasan lengkap.
- Ringkasan mengambil verdict, computed, dan missingContext aktual. Penjelasan panjang terbuka lewat disclosure; tidak diringkas dengan klaim baru atau dipotong sehingga kehilangan kualifikasi.
- Grafik awal hanya metrik/satuan yang sebanding, baseline dan nilai negatif benar. Definisi atau periode berbeda diberi label sebelum dibandingkan.
- Klik/tap atau fokus + Enter pada nilai membuka evidence. Setiap grafik menyediakan tabel/daftar ekuivalen bagi pembaca layar.
- Bukti memuat nilai lengkap, periode, waktu pengambilan, asal, dan rumus jika tersedia. Tidak membuat seri tahunan, selisih, atau skor keyakinan yang belum dihitung/didukung data.
- Status tetap tampak ketika pengguna membaca sumber. Label fixture historis/sintetis selalu jelas.
- Riwayat memakai baris yang mudah dipindai, bukan kartu statistik; pencarian/filter/keadaan kosong nyata.
- Disclaimer penuh tetap tampil di footer; bukan tooltip atau tautan pengganti.

## Satu elemen khas: lapisan pemeriksaan

Asalnya dari cara membaca laporan keuangan: kutipan/angka utama, perbandingan, lalu catatan yang mengubah interpretasi. Pengguna dapat membuka tiga lapisan “Klaim”, “Angka”, “Konteks”; kontrol tetap datar dan terbaca, sementara gerak memperlihatkan hubungan lapisannya.

Boleh muncul satu kali pada rapor yang punya data untuk lapisan terkait. Di beranda kosong, gunakan hanya preview contoh yang jelas berlabel historis bila alternatif layout terpilih memerlukannya; jangan menduplikasi elemen ini pada tiap section. Banyak klaim tidak berarti semua kartu bergerak serentak.

Kesimpulan tidak boleh tersembunyi pada sisi belakang kartu. Gerak berhenti saat selesai; lapisan yang tidak memiliki data menyatakan keterbatasannya. Bentuk dan lokasi akhir diuji lewat alternatif Fase 4. Tidak ada NFT, gambar AI, angka fiktif, atau slogan Codrops yang disalin.

## Tren, gerak, dan teknologi

Maksimal dua pendekatan:

1. Kedalaman spasial yang membantu membaca hubungan klaim–angka–konteks, khusus pada elemen khas.
2. Permukaan yang terasa seperti dokumen yang ditandai, melalui bidang solid dan penanda kutipan; tanpa simulasi kaca atau tekstur berisik.

Ambisi gerak: **2, hidup**. Satu momen khas: membuka lapisan bukti lewat tindakan pengguna. Bukan intro sinematik sebelum input tersedia.

| Gerak | Nilai usulan |
|---|---|
| Tekan/hover kontrol | 160 ms; pergeseran maksimal 1 px |
| Buka detail biasa | 220 ms; fokus/semantik tidak menunggu animasi |
| Pergantian lapisan | 360 ms; easing cubic-bezier(0.2,0.7,0.2,1) |
| Kedalaman desktop | Perspective 1200 px; tilt maksimal 4°; jarak lapisan maksimal 20 px |
| Mobile | Panel datar, tanpa tilt; perpindahan state maksimal 160 ms |
| Reduced motion | Tanpa transform/depth dan tanpa animasi otomatis; konten berganti langsung |

Teknologi awal: React state, HTML/CSS transforms dan SVG grafik. Tidak memerlukan dependency animasi atau Three.js. WebGL/GSAP bukan kebutuhan hanya karena demo memakai efek 3D. Browser/HP lemah mendapatkan versi datar dengan kontrol yang sama; tidak bergantung pada deteksi hardware yang belum tersedia. Tidak ada parallax global, scroll hijack, angka count-up, atau loop dekoratif.

## Larangan dan pemeriksaan

- Jangan menyalin tema cyberpunk terminal, panel glass, glow berlebihan, atau ilustrasi 3D generik.
- Jangan menjadikan semua section grid kartu identik atau memberi semua judul gradien.
- Jangan menambah kalimat promosi untuk mengisi ruang; copy dari KONTEN.md.
- Jangan menampilkan “Sectors” dalam judul metrik; nama provider berada di atribusi sumber. Definisi/asal angka tetap jujur, termasuk field rata-rata yang tidak dapat direproduksi.
- Jangan menyamarkan data kosong sebagai nol, contoh sebagai live, atau caption sebagai pembacaan seluruh video.
- Jangan menyampaikan nasihat investasi atau menilai kreator.
- Jangan menyimpan media dalam log/riwayat atau menyentuh API key untuk pekerjaan desain.
- Jangan menumpuk CSS override baru sebagai sumber aturan kedua. Saat implementasi disetujui, satukan token dan peran komponen secara bertahap tanpa merusak integrasi.
- Jangan mengklaim kontras, performa, mobile, atau fungsi live sudah lolos sebelum diuji.

## Status fase

- [x] Referensi utama dipilih pengguna.
- [x] Sampel token diukur di browser; kegagalan MCP dan batas sampel dicatat.
- [x] Palet, dua font, skala, grid, komponen, gerak, fallback, dan larangan ditetapkan sebagai usulan.
- [x] Spesifikasi lama diarsipkan tanpa mengubah isinya.
- [x] Pengguna menyetujui spesifikasi Fase 3 melalui pesan “lanjut”.
- [x] Fase 4: tiga alternatif layout dan tiga alternatif palet ditinjau; palet slate–biru dipilih.
- [x] Pengguna melanjutkan setelah review mobile; susunan kerja berdampingan diterapkan pada desktop dengan alur vertikal mobile.

Implementasi dan hasil validasi terbaru dicatat di docs/design-implementation-review.md. Catatan “belum diterapkan” pada bagian fase awal merupakan riwayat pengambilan keputusan; token slate–biru dan font lokal kini sudah dipakai aplikasi.

Tidak ada perubahan kode produk, dependency, atau konfigurasi pada Fase 3. Nama file tetap `design.md` mengikuti file yang sudah ada; pada Windows ini adalah file yang sama dengan `DESIGN.md`.

## Landing terintegrasi

Landing yang disetujui memakai latar slate dengan warna biru, teal dan ungu; lembar solid dalam CSS perspective, bukan glassmorphism atau model WebGL. Navigasi manual berupa panah pada sisi kartu, tanpa caption, indikator dan tombol pause di bawah. Gerak otomatis dijeda saat hover/fokus, tab tidak aktif atau visual keluar layar; reduced-motion dihormati. Semua aturan landing dibatasi pada `.landing`, font lokal dan footer digunakan bersama aplikasi.
