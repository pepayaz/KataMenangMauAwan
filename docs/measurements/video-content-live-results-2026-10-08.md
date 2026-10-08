# Hasil uji video setelah kuota Gemini dinaikkan — 8 Oktober 2026

Branch: fix/check-timeout-diagnostics. Aplikasi memakai pipeline agent, Sectors live, Supabase, dan fixtureDemo=false. Kredensial dan model tidak diganti.

## Pengujian dan temuan

Delapan link diuji melalui endpoint aplikasi /api/input dan /api/check. Lima video menghasilkan teks ready; tiga gagal di tahap pengambilan media. Putaran pertama memakai 46 kredit Sectors untuk sumber yang belum tersimpan.

Frame UNVR ditinjau langsung: tulisan menyebut tahun buku 2025. Gemini pada percobaan pertama keliru menyalinnya menjadi 2023. Prompt pembacaan diperketat untuk digit tahun/tanggal dan konflik audio/subtitle. Pembacaan UNVR kemudian diulang dan menghasilkan 2025 sesuai frame. Ini bukti perbaikan pada kasus tersebut, bukan jaminan semua transkripsi selalu benar.

Empat transkripsi video lain yang berhasil dibaca dipakai kembali tanpa koreksi manual untuk menguji ekstraksi Gemini dan pipeline baru. UNVR dibaca ulang dari video. Tidak memakai mock LLM atau fixture demo.

## Perbaikan tambahan

- PBV <1 dan yield di atas 6% diperiksa sebagai batas, bukan disamakan dengan angka 1 atau 6. Operator literal disimpan dalam klaim dan ditampilkan pada angka rapor.
- Yield nonnol tidak lagi cocok dengan yield resmi nol melalui toleransi relatif.
- Payout ratio memakai field payout_ratio, bukan yield_ttm. Periode historis atau field kosong tidak diganti dengan angka lain. Hipotesis yield historis tidak diterapkan pada payout ratio.
- Penjualan segmen tidak diganti dengan total penjualan perusahaan. Porsi laba ditahan tidak dianggap pertumbuhan laba.
- Ringkasan pertumbuhan dengan tahun lalu dapat memakai label semester unik dalam paragraf satu emiten.

## Hasil akhir

| Kasus | Klaim | Evidence | Verdict | Kredit Sectors |
| --- | ---: | ---: | --- | ---: |
| unvr-news | 7 | 12 | 5 supported, 2 unverifiable | 0 |
| bbtn-h1 | 9 | 13 | 2 refuted, 3 supported, 4 unverifiable | 0 |
| dividend-yield | 15 | 152 | 2 out_of_scope, 3 refuted, 1 supported, 9 unverifiable | 0 |
| valuation | 3 | 0 | 1 out_of_scope, 2 unverifiable | 0 |
| financial-quality | 14 | 172 | 4 misleading, 2 refuted, 2 supported, 6 unverifiable | 0 |
| adro-dividend-news | — | — | needs_text; pengambilan media belum berhasil | — |
| bbni-profit | — | — | needs_text; pengambilan media belum berhasil | — |
| bbca-dividend-youtube | — | — | needs_text; pengambilan media belum berhasil | — |

UNVR menghasilkan lima klaim cocok: Rp87 per saham, laba Rp3,33 triliun, pertumbuhan laba 10,81%, penjualan Rp27,61 triliun, dan pertumbuhan penjualan 0,71%. Data mentah memberi laba sembilan bulan Rp3.335.249.000.000 dan pendapatan Rp27.613.255.000.000. Dua gap: total dividen perusahaan belum tersedia pada sumber per saham yang diperiksa; penjualan segmen memerlukan sumber segmen dengan definisi yang sama.

BBTN: laba semester I Rp2.402.212.000.000 dan pertumbuhan sekitar 40,78% cocok. Penurunan pendapatan bunga 22% dan provisi 81% tidak cocok dengan perhitungan field masing-masing. NIM semester, PBV harian bertanggal, dan nilai transaksi portofolio memerlukan sumber dengan definisi/periode yang tepat. Harga tanpa tanggal/jendela belum dapat diverifikasi.

GJTL/AUTO/BJTM: PBV terbaru sekitar 0,4036 / 1,0368 / 0,5861. GJTL dan BJTM memenuhi PBV <1, AUTO tidak. Yield TTM nol GJTL tidak memenuhi yield >6%. Payout dibandingkan dengan field payout ratio; yang kosong tetap unverifiable. Data terbaru tidak membuktikan rasio tepat pada tanggal pembuatan video bila tanggal itu tidak disebutkan.

Jumlah klaim adalah kandidat yang diterima, bukan ukuran ketepatan atau kelengkapan ekstraksi. Penolakan unit/angka/periode yang tidak tertulis terlihat pada trace extract. Kasus AUTO merupakan model estimasi nilai wajar; asumsi expected return/growth dan proyeksi bukan fakta keuangan yang sudah terjadi.

## Validasi

965 tes pada 35 berkas, typecheck, dan build produksi lulus.

- 16 respons sumber primer tersedia dalam cache, tanpa sumber hilang.
- 16 pemeriksaan Python terhadap sumber mentah lulus; tidak mengimpor verifier aplikasi atau memanggil API tambahan.
- Putaran akhir memakai 0 kredit Sectors: mode tetap live, hasil berasal dari cache Sectors aktual. Ini bukan fixture atau cache_only.
- Biaya Gemini terpisah dari kredit Sectors; nol kredit Sectors bukan nol biaya Gemini.
- Pembacaan video berhasil pada putaran pertama sekitar 11,65–20,39 detik. UNVR yang dibaca ulang sekitar 17,49 detik. Verifikasi akhir sekitar 3,55–25,64 detik.

Artefak: video-content-live-fixed-2026-10-08.json (delapan kasus awal), video-content-live-final-2026-10-08.json (hasil setelah perbaikan), video-content-live-final-sources-2026-10-08.json (sumber mentah), video-content-live-reference-2026-10-08.json (16 pemeriksaan independen).

Untuk demo, UNVR memberikan hasil yang paling jelas; tinjau tahun 2025 pada transkripsi sebelum memeriksa. BBTN menunjukkan pemisahan klaim yang cocok, terbantah, dan sumber yang belum memadai. ADRO Dailymotion, BBNI shortlink, dan BBCA YouTube masih membutuhkan unggah video/screenshot atau teks. Jangan menyebut tiga link itu berhasil dibaca.
