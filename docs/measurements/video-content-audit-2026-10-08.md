# Pengujian link video saham — 8 Oktober 2026

Pengujian pada commit 1f383c9, branch fix/check-timeout-diagnostics, server produksi lokal http://localhost:3022. Kode produk tidak diubah dalam pengujian ini.

## Ringkasan

Delapan link asli diuji sekali melalui POST /api/input. Transkripsi yang berstatus ready diteruskan apa adanya ke POST /api/check dan seluruh event SSE disimpan. Empat video menghasilkan transkripsi; dua berhenti dengan nol klaim karena ticker tidak dikenali; dua sampai ke pembandingan numerik. Empat link lain gagal di tahap input. Ini belum cukup untuk menyatakan input video lintas saham/platform sudah andal.

Konfigurasi yang dibaca dari health endpoint: mode live, Supabase tersambung, LLM aktif, fixtureDemo false. Mode live tetap memakai cache Sectors yang sesuai; pembacaan cache bukan data sintetis. Total kredit tambahan yang dilaporkan delapan cek adalah 1. Dua kontrol teks tambahan memakai 0 kredit. Biaya dan tagihan Gemini tidak diukur.

## Metode mengikuti laporan uji teman

Laporan teman memeriksa 42 kalimat terkontrol terhadap kunci independen. Pengujian ini memperluasnya ke konten video asli sehingga turut menguji unduhan, transkripsi, identifikasi ticker, ekstraksi, router, verifier, Context Hunter, dan penjelasan. Dua kontrol teks berangka benar dan sengaja salah dipakai untuk membedakan kemampuan pembandingan dari masalah input. Jumlah dan jenis sampel berbeda, sehingga hasilnya tidak boleh dibandingkan sebagai persentase akurasi 41/42.

Kunci BBTN dihitung ulang dengan Python langsung dari respons mentah cache Sectors yang dipakai cek, tanpa mengimpor verifier aplikasi dan tanpa menjadikan nilai computed keluaran aplikasi sebagai acuan. Pembacaan sumber dilakukan melalui cache packages/sectors, tanpa panggilan Sectors live tambahan.

Transkripsi tidak dikoreksi manual. Kesetiaan seluruh audio/frame belum dinilai secara manual; label ready menunjukkan pembaca mengembalikan teks, bukan bukti semua detail video telah benar. Tidak ada pengujian klik visual browser pada sesi ini.

## Hasil per link

| Video | Input | Waktu baca / cek | Klaim dan hasil |
|---|---|---|---|
| [BBTN: laporan semester I 2026](https://www.tiktok.com/@olivia.louise04/video/7664241348140272917) | ready | 15.77 dtk / 20.52 dtk | 12 klaim; 4 didukung, 3 dibantah, 5 belum terverifikasi |
| [Saham nonbank: dividend yield](https://www.tiktok.com/@olivia.louise04/video/7663503114313534740) | ready | 18.44 dtk / 0.42 dtk | 0 klaim; ticker terlewat |
| [Nilai wajar berbasis dividen](https://www.tiktok.com/@olivia.louise04/video/7670891057772580116) | HTTP 503 | 66.69 dtk / — | Tidak diteruskan ke pemeriksaan |
| [Kualitas perusahaan dan dividen](https://www.tiktok.com/@olivia.louise04/video/7669806798244744469) | ready | 17.11 dtk / 0.73 dtk | 0 klaim; ticker terlewat |
| [BBNI: laba rekor dan konteks](https://vt.tiktok.com/ZS8AqxFaP/) | needs_text | 4.70 dtk / — | Tidak diteruskan ke pemeriksaan |
| [BBCA: dividen tahun buku 2025](https://www.youtube.com/watch?v=Ru1jbrcX5Lc) | needs_text | 3.29 dtk / — | Tidak diteruskan ke pemeriksaan |
| [UNVR: berita dividen dan laba 2025](https://www.tiktok.com/@idxchannel/video/7581460698346097936) | ready | 16.79 dtk / 6.54 dtk | 4 klaim; 1 didukung, 3 belum terverifikasi |
| [ADRO: dividen tunai 2024](https://www.dailymotion.com/video/x8yiroa) | needs_text | 58.86 dtk / — | Tidak diteruskan ke pemeriksaan |

## Pembanding independen BBTN

| Metrik H1 2026 | Data mentah independen | Hasil program |
|---|---|---|
| Laba bersih | Rp2.402.212.000.000 | Rp2.402.212.000.000 |
| Pertumbuhan laba bersih | 40,777513% | 40,78% |
| Pertumbuhan pendapatan bunga bruto | −11,724781% | −11,72% |
| Pertumbuhan beban provisi | −57,925153% | −57,93% |

Enam pembandingan financial yang dibuat program cocok dengan hitungan independen (sebagian merupakan klaim berulang pada metrik yang sama). Selisih pembulatan pertumbuhan kurang dari 0,0051 poin persentase. Ini membuktikan ketepatan hitungan pada field/periode tersebut, bukan ketepatan pemilihan semantik semua klaim video.

Video BBTN kali ini menghasilkan 12 klaim, 36 evidence, 4 didukung, 3 dibantah, 5 belum dapat diverifikasi. Dibanding pengujian sebelumnya (10 klaim), transkripsi baru turut menangkap teks grafik PBV dan pengulangan laba. Evidence count bukan jumlah sumber independen; beberapa evidence adalah angka turunan, konteks, atau sumber yang dipakai ulang.

Kontrol teks: laba Rp2,4 triliun dan pertumbuhan 40,8% H1 2026 menghasilkan dua supported. Mengubahnya menjadi Rp5 triliun dan 90% menghasilkan dua refuted. Keempat verdict sesuai kunci independen; tidak ada kredit Sectors tambahan.

## Temuan yang perlu diperbaiki

### 1. P0 — Daftar ticker aplikasi terlalu terbatas

Video dividend-yield memuat ULTJ, MLBI, DLTA; video financial-quality memuat GJTL, AUTO, BJTM. Kedua cek menghasilkan normalize status ready dengan entities kosong, lalu extract kosong dan done. Tidak ada permintaan konfirmasi. Aplikasi memakai createFixtureTickerDirectory ditambah ticker dari alias; log menunjukkan tabel alias kosong dan daftar manual dipakai. Kode kapital telanjang hanya diterima bila ada dalam directory, sehingga ticker riil di luar seed/alias bisa hilang tanpa penjelasan.

Perbaikan yang disarankan: muat daftar emiten resmi lengkap dari cache; bedakan ticker tidak dikenal dari teks tanpa saham; minta konfirmasi jika ada kandidat belum terpetakan. Jangan mengambil empat huruf kapital sembarang sebagai saham. Uji regresi harus mencakup keenam ticker tersebut dan kata biasa seperti BANK.

### 2. P0 — Konteks waktu tidak melekat konsisten pada pengulangan klaim

Dalam video BBTN, PBV 0,47 pada 19 Jul 2026 menghasilkan unverifiable karena sumber valuation tahunan tidak menyediakan tanggal itu. Ucapan PBV 0,47 di bagian akhir diekstrak lagi tanpa periode, lalu dibandingkan dengan PBV terbaru 0,3939855 dan menghasilkan refuted. Hitungan sumber terbaru benar, tetapi penerapan pembanding terbaru pada video lama berisiko memberi kesimpulan salah.

Perbaikan yang disarankan: bawa tanggal konteks grafik/video ke ucapan yang jelas merujuk angka sama; bila hubungan ambigu minta klarifikasi. Gabungkan klaim berulang hanya bila ticker, metrik, nilai, unit, dan periode benar-benar sama. Tampilkan tanggal acuan pembanding.

### 3. P0 — Periode kumulatif sembilan bulan belum didukung

Video UNVR menyebut laba Rp3,33 triliun hingga kuartal tiga 2025 dan pertumbuhan 10,81%. Dua klaim ini menghasilkan Periode laporan belum jelas dan sourceQueried false. Ini bukan bukti Sectors kekurangan laba UNVR; router menolak sebelum sumber diminta. Tiga kandidat lain ditolak PERIOD_NOT_WRITTEN, sehingga sebagian penjualan dan segmen yang tertulis tidak sampai verifier.

Perbaikan yang disarankan: parser hingga Q3/9M/YTD, jumlah Q1+Q2+Q3 dengan tahun pembanding, basis standalone versus kumulatif tetap dibedakan; perbaiki pewarisan periode untuk klaim penjualan dalam paragraf yang sama. Penjualan per segmen membutuhkan field spesifik, tidak boleh diganti revenue total.

### 4. P0 — Tanggal data dividen disebut sebagai tanggal pembayaran

Dividen UNVR Rp87 cocok dengan respons Sectors; pemeriksaan nominalnya masuk akal. Namun penjelasan menyebut dibayarkan pada 15 Desember 2025, mengikuti date pada breakdown. Laporan keuangan resmi Unilever mencatat pembayaran 30 Desember 2025. Angka yang grounded belum tentu memiliki label tanggal yang benar.

Sumber pembanding: [Laporan keuangan Unilever 2025, catatan 22](https://www.unilever.co.id/files/indonesia-financial-statements-q4-2025.pdf). Label tanggal harus mengikuti definisi sumber; gunakan tanggal data/peristiwa yang netral jika belum jelas, atau ambil payment_date yang eksplisit dari corporate actions. Jangan menyamakan total dividen yang keluar pada tahun kalender dengan total dividen tahun buku (Rp47 pada 2025 adalah dividen final tahun buku 2024).

### 5. P1 — Kegagalan media terlalu umum

Video valuation mendapat HTTP 503 setelah 66,70 detik dengan pesan generik. Dari respons publik tidak dapat dipastikan apakah timeout, struktur jawaban, atau error provider. Link pendek BBNI, YouTube BBCA, dan Dailymotion ADRO mendapat needs_text. Tidak ada pemeriksaan angka dijalankan untuk kasus-kasus ini; kasus gagal input bukan verdict unverifiable.

Perbaikan yang disarankan: kode penyebab tersanitasi pada unduhan/transkripsi, metrik durasi tiap tahap, pembatasan dan pesan fallback yang tepat. Jangan menyatakan video privat, dihapus, atau diblokir login tanpa bukti penyebab. Retry terkontrol hanya untuk kegagalan sementara.

### 6. P1 — Penjelasan grounding sering menjadi template

Pada BBTN, beberapa klaim dengan evidence mendapat penjelasan generik setelah generasi. Log mencatat panggilan claim_explanation berulang, sementara hasil akhirnya tidak memuat ringkasan pembanding. Grounding menjaga keluaran, tetapi gagal generasi dapat menambah biaya tanpa memberi penjelasan lebih baik. Susun ringkasan deterministik metrik/periode/angka sebelum penjelasan tambahan; ukur alasan penolakan grounding dan jumlah retry. Biaya aktual belum dihitung pada sesi ini.

## Kekurangan bukti yang memang teridentifikasi

- NIM BBTN H1 2026: sumber financials yang diperiksa memiliki historical_financial_ratio tahunan 2018–2025, bukan rasio H1 2026. Tidak mengganti semester dengan tahun terbaru.
- PBV BBTN 19 Jul 2026: respons valuation yang diperiksa menyediakan tahun 2022–2026, bukan rasio pada tanggal harian itu.
- Akuisisi portofolio pensiun: verifier/sumber transaksi khusus belum diimplementasikan; sourceQueried false. Tidak dapat disimpulkan bahwa seluruh Sectors tidak memiliki datanya.
- Total dividen UNVR Rp3,3 triliun: verifier dividen memakai data per saham. Pembuktian total memerlukan field total perusahaan atau jumlah saham yang berhak pada tanggal yang tepat. Jangan langsung memakai jumlah saham terbaru.
- Harga/perubahan harian di overlay tanpa tanggal: jendela tidak jelas; jangan mengarang tanggal dari waktu pengujian.

## Kesimpulan

Jalur pembandingan numerik yang terpetakan sudah terbukti membaca data Sectors dan menghitung dengan benar pada sampel BBTN serta menemukan dividen UNVR Rp87. Akan tetapi program belum andal untuk sembarang link video saham: directory ticker, periode kumulatif, konteks tanggal, dan label peristiwa dividen masih menjadi hambatan nyata. Prioritas sebelum demo terbuka adalah empat temuan P0. Jangan mempresentasikan 2/8 sebagai akurasi klaim atau menganggap jumlah evidence menunjukkan kelengkapan semua data Sectors.

## Berkas bukti

- video-content-audit-2026-10-08.json: input, transkripsi, HTTP, durasi, semua SSE trace dan result delapan video.
- video-content-sources-2026-10-08.json: respons mentah empat sumber cache yang dipakai verifier, fetchedAt dan params.
- video-content-independent-reference-2026-10-08.json: hitungan independen dan selisih pembanding.
- video-content-controls-2026-10-08.json: dua kontrol teks, empat klaim, verdict dan trace.
- eval/video-content: skrip pengujian; panggilan berbayar memerlukan --execute eksplisit.

Discovery video baru: [indeks video Olivia](https://urlebird.com/user/olivia.louise04/), [tautan resmi yang dibagikan Creative Trader](https://t.me/s/creativetrader?before=26982&q=%23saham), [berita video ADRO](https://www.dailymotion.com/video/x8yiroa), dan hasil pencarian YouTube BBCA. Indeks pencarian dipakai untuk menemukan URL; pemeriksaan konten memakai URL platform asli melalui aplikasi.

Validasi repositori setelah pengujian: typecheck lulus; 919 tes pada 32 berkas lulus. Build produksi yang diuji adalah build commit 1f383c9; kode aplikasi tidak diubah.
