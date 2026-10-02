# Tiga rencana layout — Fase 4

Status: rencana telah disetujui melalui pesan “lanjut”; tiga mockup desktop sudah tersedia. Menunggu pilihan arah final sebelum adaptasi mobile dan implementasi. Kode aplikasi belum diubah.

Dasar: KONTEN.md, REFERENSI.md, dan design.md. Layar pertama adalah layar pemeriksaan yang dipakai pengguna, bukan landing page promosi. Rencana posisi di bawah ditulis sebagai tabel agar tidak menampilkan diagram berbentuk kode.

## Aturan bersama

- Logo asli Cek Dulu, judul “Periksa klaim saham”, empat mode “Teks”, “Screenshot”, “Link video”, “Unggah video”, serta tindakan berikutnya harus ditemukan langsung.
- Palet enam warna: #111A22 canvas; #21313F permukaan; #F1F4F2 teks; #72D6C5 aksi/identitas; #9AAFF2 pembanding/fokus; #F0BC70 konteks. Proporsi pemakaian dibedakan per arah; tidak menambah tema baru.
- Barlow Semi Condensed untuk judul/angka utama; Source Sans 3 untuk isi/kontrol. Judul layar 38/30 px desktop/mobile, bagian 24/22 px, isi 17/16 px, minimum teks 14 px. Logo tidak diganti fontnya.
- Lebar halaman maksimal 1200 px, gutter desktop 32 px/mobile 16 px, gap desktop 24 px/mobile 16 px, jarak bagian 48/32 px. Footer memakai disclaimer lengkap KONTEN.md.
- Visualisasi harus berasal dari evidence. Kutipan berasal dari span klaim; penanda atau coretan menempel pada bagian yang relevan, bukan hiasan acak.
- Kesimpulan tidak tersembunyi di balik interaksi. Grafik, penjelasan lengkap, warning dan sumber tetap dapat diakses dengan keyboard dan sentuhan.
- Tiga frame pertama nanti memakai keadaan awal yang sama: input teks kosong dengan placeholder yang sudah ada. Jika arah memerlukan preview, gunakan fixture ADRO dengan label “Contoh historis” dan “Angka contoh bukan data pasar terkini.” Tidak boleh seolah-olah pengguna sudah menjalankan cek.
- Perbandingan warna/status tidak membuat skor confidence, data live, ticker bergerak, atau angka kredit palsu.

## Arah 1 — Form pemeriksaan bertahap

**Kesan:** alat yang cepat dipahami, fokus pada satu langkah dan tidak memaksa pengguna menjelajah.

### Susunan layar pertama

| Posisi | Isi dan ukuran |
|---|---|
| Header | Logo kiri; navigasi pemeriksaan, riwayat, tersimpan dan satu tautan Tentang; tidak ada badge “Data tersimpan” |
| Awal konten | Judul layar rata kiri dalam kolom maksimal 720 px |
| Area utama | Satu form lebar, empat pilihan input, satu editor/field sesuai mode; tidak ada kolom dekorasi di samping |
| Bawah form | Satu tindakan utama, contoh ADRO/BBCA/BBRI sebagai pilihan kecil berlabel; bantuan rinci lewat disclosure |
| Bila ada | “Rapor terakhir” sebagai satu baris yang dapat dibuka, bukan statistik |
| Footer | Disclaimer lengkap dan atribusi sumber |

### Alur setelah input

Media menampilkan langkah Baca → Tinjau → Cek dalam posisi form yang sama. Progres mengganti area tindakan tanpa menumpuk panel. Setelah selesai, rapor tampil di bawah form dengan status, kutipan, pasangan angka dan konteks singkat; penjelasan lengkap terbuka bila diminta. Sumber menjadi tampilan detail, grafik dahulu lalu bukti terpilih.

**Elemen khas:** satu penanda pada kutipan klaim yang terhubung ke angka pembanding. Asalnya dari menandai angka dalam laporan, bukan dari iconografi robot. Lapisan bukti hadir sebagai urutan datar, bukan objek 3D.

**Warna:** canvas dominan; toska hanya tombol utama/logo; biru untuk pembanding/fokus; amber muncul bila ada konteks. Tidak ada blok warna besar untuk mengisi ruang kosong.

**Tren:** permukaan dokumen solid dan pengungkapan detail bertahap. Hanya permukaan yang terasa fisik dari dua pendekatan design.md digunakan; kedalaman spasial dimatikan pada arah ini.

**Gerak:** ambisi 1, tenang. Tekan 160 ms, disclosure 220 ms; signature berupa penanda kutipan yang berubah ketika bukti dipilih. React/CSS/SVG, tanpa tilt. Reduced motion mengganti state langsung.

**Sentuhan manusia:** penandaan pada kutipan asli dan catatan konteks aktual. Tidak menambahkan tulisan tangan palsu, tekstur stok, atau foto.

### Uji keunikan dan perbaikan

- Bagian generik: form satu kolom dapat dimiliki aplikasi apa pun. Pembeda harus ada pada hubungan span angka → pembanding → catatan konteks, bukan judul besar.
- Risiko AI slop: tampilan terasa kosong bila memakai hero besar dan paragraf penjelasan. Perbaikan: tidak memakai hero pemasaran; form menjadi isi utama, bantuan ditampilkan sesuai mode.
- Kompas layar pertama: lolos secara rencana karena input dan tindakan berikutnya mendominasi. Perlu dibuktikan di frame.
- Kekurangan: paling mudah dipakai, tetapi paling sedikit memenuhi keinginan pengguna akan tampilan yang menonjol. Cocok sebagai alternatif pembanding yang tenang, bukan rekomendasi utama.

## Arah 2 — Pemeriksaan berdampingan

**Kesan:** pengguna langsung melihat hubungan antara pernyataan yang dimasukkan dan bukti yang menjelaskan hasilnya.

### Susunan layar pertama

| Posisi | Isi dan ukuran |
|---|---|
| Header | Logo kiri; navigasi horizontal yang ringkas; judul halaman tetap di area konten |
| Awal konten | “Periksa klaim saham” dengan skala judul bersama |
| Kiri, 5 dari 12 kolom | “Masukkan klaim”, mode input, editor/field, tindakan membaca/cek; pengguna dapat bekerja tanpa berpindah bagian |
| Kanan, 7 dari 12 kolom | Satu preview fixture ADRO berlabel historis: kutipan, verdict, pembanding dan konteks; bukan kumpulan kartu KPI |
| Penghubung | Pemilihan angka/kutipan menyorot pasangan bukti; koneksi tidak hanya menggunakan garis atau warna |
| Footer | Disclaimer dan sumber, tanpa banner promosi |

Preview memberi gambaran hasil sebelum cek, menggunakan konten fixture secara transparan. Pada layar sempit, preview turun setelah form dan tidak menghalangi tombol; tidak tampil berdampingan dengan editor 360 px. Preview dapat ditutup, dan bukan hasil input yang belum diperiksa.

### Alur setelah input

Kiri menjadi tempat meninjau/mengoreksi konten. Kanan berganti dari preview ke progres aktual, lalu rapor aktual. Banyak klaim memakai daftar pilihan klaim yang ringkas; satu rapor aktif terbaca luas. Jangan membuang klaim lain atau membingungkan status per klaim dengan status keseluruhan.

“Lihat sumber” membuka detail yang mempertahankan status dan kutipan. Grafik menjadi konten utama; memilih batang/titik membuka bukti terkait. Penjelasan lengkap berada di disclosure, bukan paragraf awal. Pada HP semua bagian menjadi alur vertikal: input → status → angka → konteks → sumber.

**Elemen khas:** kutipan dan catatan bukti yang saling menyorot. Lapisan Klaim/Angka/Konteks membuka informasi pada bidang kanan, bukan sekadar kartu dekoratif berputar. Asalnya dari membandingkan angka dalam pernyataan dengan catatan laporan.

**Warna:** toska menandai angka klaim, biru menandai pembanding, amber menandai konteks. Label menyebut maknanya secara eksplisit. Gradien tipis toska–biru boleh pada tepi elemen hubungan tersebut; bidang isi tetap solid.

**Tren:** kedalaman spasial ringan dan permukaan dokumen yang ditandai. Dua pendekatan ini dibatasi pada rapor aktif.

**Gerak:** ambisi 2, hidup; signature pergantian lapisan 360 ms dengan tilt maksimal 4° hanya desktop. Mikrointeraksi 160 ms. React/CSS transforms/SVG. HP menggunakan panel datar 160 ms; reduced motion tanpa transform.

**Sentuhan manusia:** bagian kutipan yang disorot serta catatan pembayaran khusus/periodisasi dari evidence. Tidak ada ilustrasi robot, chart fiktif, atau slogan.

### Uji keunikan dan perbaikan

- Bagian generik: layout split bisa menjadi chat AI biasa. Perbaikan: kanan berstruktur verdict–angka–konteks, bukan bubble jawaban atau pesan sambutan AI.
- Risiko AI slop: tumpukan kartu seragam dan terlalu banyak label kecil. Perbaikan: satu rapor luas; status, perbandingan dan catatan memiliki bentuk/hierarki berbeda tanpa membuat semua elemen bergerak.
- Kompas layar pertama: lolos secara rencana karena input tetap jelas dan preview menunjukkan jenis keluaran. Label historis harus terlihat pada frame tanpa membuka detail.
- Kekurangan: lebih banyak informasi awal daripada arah 1. Preview dibatasi ke satu klaim historis; tidak menaruh penjelasan penuh atau puluhan bukti di layar pertama.

**Rekomendasi utama:** menyeimbangkan tampilan yang menonjol, bukti visual, penggunaan desktop/mobile, dan waktu implementasi hackathon.

## Arah 3 — Lapisan bukti spasial

**Kesan:** pengguna membuka lapisan klaim untuk melihat bagaimana sebuah angka mendapatkan konteks, dengan pemeriksaan tetap langsung tersedia.

### Susunan layar pertama

| Posisi | Isi dan ukuran |
|---|---|
| Header | Logo dan navigasi ringkas seperti aturan bersama |
| Awal konten | Judul layar; tidak ada slogan/intro yang harus ditonton |
| Tengah, sekitar 8 dari 12 kolom | Form input menjadi bidang depan; empat mode dan tindakan jelas, tanpa editor yang ikut miring |
| Samping/di belakang secara visual | Preview ADRO historis dalam tiga lapisan berjudul Klaim, Angka, Konteks; kontrol di bidang datar di luar objek |
| Saat lapisan dibuka | Bidang bukti maju ke posisi baca datar; verdict tetap terlihat pada area terpisah |
| Footer | Disclaimer utuh; tidak ikut bergerak atau tertutup scene |

Object preview tidak membutuhkan scroll untuk terbuka. Bidang belakang tidak memuat teks kecil yang harus dibaca dalam perspektif. Pada HP, lapisan menjadi tiga kontrol dengan satu panel datar; form tetap paling atas.

### Alur setelah input

Setelah cek, isi lapisan berasal dari klaim/evidence aktual. Pengguna memilih lapisan: Klaim menampilkan kutipan, Angka menampilkan pembanding, Konteks menampilkan hipotesis dan bukti. “Lihat sumber” membuka daftar/grafik sumber lengkap di bidang datar, bukan di dalam objek yang harus diputar. Hasil banyak klaim disajikan sebagai pilihan di luar scene.

**Elemen khas:** tiga lembar informasi yang memiliki kedalaman, lalu bergerak maju menjadi bidang baca. Asalnya dari membongkar catatan di balik angka laporan. Adaptasi Codrops mengambil gerak lapisannya, tidak mengambil foto NFT atau teks demo.

**Warna:** bidang utama gelap; tepi lapisan memakai toska untuk klaim, biru untuk angka, amber untuk konteks. Isi selalu solid dan terang; gradien tepi membantu kedalaman tanpa menerapkan glassmorphism.

**Tren:** kedalaman spasial dan permukaan dokumen yang ditandai; tidak menambah tren ketiga.

**Gerak:** ambisi 3, imersif, hanya scene bukti; bagian lain tenang. Usulan desktop: perspective 1400 px, jarak kedalaman maksimal 64 px, tilt maksimal 6°, transisi 480 ms. Kamera tidak mengikuti cursor, tidak ada scroll hijack atau loop. React/CSS 3D dapat dipakai dahulu; WebGL tidak menjadi kebutuhan otomatis.

**Pengecualian yang perlu dipilih secara eksplisit:** angka gerak di atas melampaui ambisi 2/tilt 4°/kedalaman 20 px dalam design.md. Arah ini disediakan untuk perbandingan sesuai panduan Fase 4, belum mengganti spesifikasi yang disetujui. Bila arah 3 dipilih final, revisi token geraknya harus disetujui sebelum implementasi.

Fallback: mobile dan reduced motion memakai tab/panel datar dengan konten serta kontrol yang sama. Jika transforms tidak didukung, konten tetap terbaca sebagai urutan biasa. Tidak mendeteksi “HP lemah” berdasarkan tebakan perangkat.

**Sentuhan manusia:** catatan dan penanda pada konten klaim asli; urutan lapisan mengikuti cara menelusuri dokumen keuangan, bukan objek 3D tanpa fungsi.

### Uji keunikan dan perbaikan

- Bagian generik: stack 3D bisa menjadi katalog atau portfolio. Perbaikan: ketiga lapisan memiliki peran pemeriksaan nyata dan menuju evidence terkait, bukan kumpulan gambar.
- Risiko AI slop: gerak berlebihan dan teks tersembunyi. Perbaikan: input/verdict/kontrol selalu datar; isi hanya dibaca setelah lapisan menjadi panel datar; tidak memaksa animasi sebelum pengguna bekerja.
- Kompas layar pertama: dapat lolos jika form tetap dominan. Frame harus membuktikan scene tidak merebut fokus dari tindakan input.
- Kekurangan: risiko keterbacaan, fokus keyboard, overflow dan performa paling tinggi. Tidak disarankan sebagai default seluruh aplikasi; layak diuji sebagai satu momen khas.

## Perbandingan keputusan

| Aspek | Arah 1 | Arah 2 | Arah 3 |
|---|---|---|---|
| Organisasi utama | Urutan satu kolom | Konten dan pembanding berdampingan | Bidang input dan lapisan yang dibuka |
| Ambisi gerak | 1, tenang | 2, hidup | 3, imersif terbatas |
| Kekuatan | Fokus dan kecepatan | Hubungan klaim–bukti mudah terlihat | Identitas visual paling menonjol |
| Risiko utama | Terasa terlalu sederhana | Preview menambah kepadatan | Kompleksitas gerak dan keterbacaan |
| Mobile | Alur satu kolom sejak awal | Kolom berubah menjadi urutan | Scene diganti panel datar |
| Kecocokan brief | Tinggi pada kemudahan | Paling seimbang | Tinggi pada karakter, perlu pengujian lebih |

Penilaian ini adalah pertimbangan, bukan hasil usability test atau benchmark performa. Tidak ada angka peningkatan konversi atau klaim waktu pengerjaan yang dibuat-buat.

## Langkah berikutnya

Setelah ketiga rencana disetujui, buat tiga frame 1440 × 900 berdampingan dengan konten dan keadaan awal yang setara; tampilkan satu adaptasi HP 390 × 844 untuk arah yang kemudian dipilih. Kritik frame terhadap KONTEN.md, skala teks, label historis, warning, dan larangan AI slop sebelum menyerahkan.

Mockup dibuat lewat pen.dev/pencil jika kanvas tersedia. Tidak menganggap mockup statis sudah membuktikan animasi atau alur API. Implementasi produk dilakukan setelah alternatif visual dan pemeriksaan desain disetujui.

- [x] Tiga arah berbeda, termasuk satu tenang dan satu imersif.
- [x] Posisi input, tindakan, rapor, sumber, mobile dan risiko dijelaskan.
- [x] Palet/font tetap mengacu pada spesifikasi; pengecualian arah 3 dinyatakan.
- [x] Uji keunikan, risiko AI slop dan perbaikan tiap arah tercatat.
- [x] Pengguna menyetujui rencana sebelum tiga frame dibuat.
- [ ] Pengguna menilai frame dan memilih arah final.

## Mockup untuk ditinjau

[Perbandingan tiga arah](design-mockups/exports/comparison.png), [arah 1](design-mockups/exports/direction-1.png), [arah 2](design-mockups/exports/direction-2.png), dan [arah 3](design-mockups/exports/direction-3.png).

Preview lokal: http://127.0.0.1:3012/?view=all. Catatan pembuatan, sumber aset, batas mockup, dan pemeriksaan tersedia di [README mockup](design-mockups/README.md). Semua tombol pemeriksaan masih statis; label contoh historis tetap terlihat. Mockup tidak membuktikan responsivitas mobile atau animasi produksi.
