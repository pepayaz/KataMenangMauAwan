# Pengujian video nyata

Skrip ini menguji aplikasi yang sudah berjalan, tidak mengganti provider, flag, mode Sectors, atau kredensial aplikasi. Tidak memakai fixture demo.

- run.py mengirim delapan link tetap ke /api/input dan melanjutkan ke /api/check hanya jika teks ready. Memerlukan --execute eksplisit. --ids membatasi subset. --output dapat dipakai untuk hasil baru. Kasus yang sudah ada di output tidak diulang.
- controls.py menjalankan dua kontrol teks BBTN. Memerlukan --execute eksplisit; tetap memakai endpoint aplikasi dan dapat memakai LLM berbayar.
- read-sources.mts hanya membaca cache dari factory packages/sectors dan menyimpan sumber mentah, tanpa request Sectors live. Jalankan dengan runtime tsx dan environment aplikasi yang sudah tersedia; jangan menyalin kredensial ke skrip.
- independent-reference.py menghitung jumlah dan pertumbuhan dari JSON sumber mentah menggunakan Python, tanpa verifier aplikasi.

Hasil 8 Oktober 2026 ada pada docs/measurements/video-content-audit-2026-10-08.md. Jangan menganggap ready atau HTTP 200 sebagai bukti pemeriksaan berhasil; periksa entities, claims, trace error, sourceCalls, coverage, dan verdicts. Biaya Gemini belum diukur. Jangan menjalankan pengujian berbayar berulang tanpa kebutuhan.
