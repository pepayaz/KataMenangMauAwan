# Perbaikan pemeriksaan konten video — 8 Oktober 2026

Branch: fix/check-timeout-diagnostics.

## Perbaikan

- Direktori runtime kini mencakup 962 emiten dari snapshot daftar perusahaan Sectors, bukan hanya saham demo. Daftar API dibaca melalui pagination limit 200 dan respons results dinormalisasi. ULTJ, MLBI, DLTA, GJTL, AUTO, dan BJTM kini dikenali tanpa permintaan API direktori setiap pemeriksaan.
- Kata biasa seperti bank, laba, naik, pada, satu, uang, dan utang tidak otomatis menjadi ticker lain. Kode bertanda dan saham BANK tetap dikenali. Kode saham yang tidak dikenal meminta klarifikasi.
- Hingga kuartal tiga / 9M diperlakukan sebagai kumulatif Q1–Q3, dengan periode pembanding yang sama. Periode dan tanggal grafik dalam paragraf satu emiten dipertahankan. PBV bertanggal tidak diganti dengan valuasi tahunan terbaru.
- Permintaan historis mengisi kuartal yang tepat melalui report_date dan approx=false. Dokumentasi Sectors mendefinisikan n_quarters sebagai kuartal paling baru; kombinasi lama report_date+n_quarters terbukti mengembalikan data terbaru, sehingga tahun pembanding tidak ikut terambil. Kuartal relevan yang sudah di-cache dipakai kembali.
- Tanggal data dividen tidak disebut tanggal pembayaran. Dividen per saham tidak digunakan sebagai total dividen perusahaan. Penjelasan nominal dividen memakai hasil deterministik agar tidak memerlukan generasi LLM tambahan.
- Kegagalan pembacaan kini memuat kode penyebab seperti LLM_QUOTA, LLM_TIMEOUT, atau LLM_INVALID_OUTPUT dan pesan yang aman; bukan hanya HTTP 503 generik.

Referensi kontrak endpoint: https://docs.sectors.app/api-references/v2/indonesia/report/quarterly-financials; schema resmi: https://github.com/supertypeai/sectors_api_docs/blob/main/schema.json.

## Hasil uji ulang

Pengujian ulang menggunakan transkripsi dan kandidat ekstraksi dari pengujian video sebelumnya, kemudian menjalankan normalisasi, validasi kandidat, router, verifier, dan adjudicator yang diperbaiki dengan Sectors aktual. Ekstraksi tidak dibuat ulang oleh Gemini; Context Hunter tidak mengusulkan hipotesis baru dalam replay ini.

| Kasus | Hasil |
| --- | --- |
| BBTN H1 2026 | 11 klaim, 13 evidence; 3 supported, 2 refuted, 6 unverifiable. Laba nominal Rp2.402.212.000.000 dan pertumbuhan sekitar 40,78% sesuai. Penurunan pendapatan bunga dan provisi dibandingkan dengan field masing-masing, bukan total laba. PBV pada 19 Jul 2026 tidak difalsifikasi menggunakan data tahunan terbaru. |
| UNVR | 4 klaim, 8 evidence; 3 supported dan 1 unverifiable. Dividen Rp87 per saham cocok; laba Q1–Q3 2025 Rp3.335.249.000.000 dibanding laba Q1–Q3 2024 Rp3.009.698.000.000 menghasilkan 10,8167331%, sesuai klaim 10,81%. Total dividen perusahaan belum dapat dibuktikan dari sumber dividen per saham yang diperiksa. |
| Video ULTJ / MLBI / DLTA | Ketiga emiten dikenali, normalisasi ready, tanpa pilihan saham palsu dari kata utang. Ekstraksi dan verdict baru belum diuji karena kuota Gemini. |
| Video GJTL / AUTO / BJTM | Ketiga emiten dikenali, normalisasi ready. Ekstraksi dan verdict baru belum diuji karena kuota Gemini. |

UNVR memerlukan tiga kuartal historis tambahan: Q1, Q2, Q3 2024. Tiga kredit Sectors dipakai untuk pengambilan itu; replay berikutnya memakai cache dan menghabiskan nol kredit. Pemanggilan tujuh kredit sebelum koreksi periode yang sempat gagal dicatat karena checkId bukan UUID telah dicatat ulang sekali dan dikonfirmasi melalui ledger. Sumber dan perhitungan terpisah tersedia pada unvr-historical-source-2026-10-08.json.

## Validasi dan batas pengujian

- 941 tes otomatis pada 34 berkas lulus.
- Typecheck lulus.
- Build produksi lulus.
- Empat percobaan pembacaan video baru melalui aplikasi berhenti dengan LLM_QUOTA. Detail tersedia pada video-content-fixed-2026-10-08.json. Pembacaan video dan ekstraksi baru belum dapat dinyatakan berhasil diuji ulang sampai kuota tersedia.
- Akses download video yang dibatasi platform tetap dapat memerlukan unggah berkas atau teks. Perubahan ini tidak membuktikan semua link YouTube, TikTok pendek, atau Dailymotion sudah bisa diunduh.
- Unverifiable tetap digunakan bila metrik, granularitas periode, atau sumber tidak cocok. Contoh BBTN: NIM semester memerlukan rasio semester, PBV harian bertanggal memerlukan sumber tanggal tersebut, dan nilai akuisisi portofolio memerlukan field yang sesuai. Tidak dipaksakan menggunakan angka lain.

Artefak: video-content-fixed-replay-2026-10-08.json, idx-directory-source-2026-10-08.json, unvr-historical-source-2026-10-08.json. Replay opt-in: eval/video-content/fixed-replay.mts --execute, dengan environment aplikasi dan runtime tsx.
