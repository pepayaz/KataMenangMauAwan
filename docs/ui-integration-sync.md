# Sinkronisasi branch UI dan integration-core

Branch `feat/ui-investigation-console` menggabungkan `feat/integration-core`
sampai commit `acba4f846e5659a591d180a5ceca15509d5198eb`.

Perubahan yang masuk:

- `1a684e0`: kegagalan ekstraksi AI dikirim sebagai error terkontrol dengan
  penyebab kuota/layanan tidak tersedia, bukan dianggap konten tanpa klaim.
- `acba4f8`: nominal dividen per saham diperiksa terhadap pembayaran, total
  tahunan, atau nominal TTM dalam rupiah. Hipotesis konteks yield tidak
  diterapkan pada klaim nominal per saham.

Konflik hanya pada komponen rapor dan test kontrak UI. Penyelesaian mempertahankan
grafik, kartu angka, hierarki status, font, logo, serta gradien branch UI, sambil
menambahkan tampilan kegagalan ekstraksi. Seluruh test dari kedua sisi tetap ada;
ekspektasi teks kosong disesuaikan dengan redaksi UI yang sudah diperbarui.

Tambahan uji integrasi menjalankan normalizer, extractor mock, verifier asli,
registry hipotesis, adjudicator, dan grounding pada nominal dividen Rp87 per saham.
Data sintetis berasal dari cache; tidak ada panggilan jaringan atau kredit live.

Validasi: `pnpm test` lulus 760 test di 27 file dan `pnpm -r typecheck` lulus.
Identitas revisi di dialog Tentang Cek Dulu mengikuti commit saat build.
Sinkronisasi ini tidak mengubah branch integration-core atau main dan tidak
menyertakan file lokal yang tidak dilacak Git.
