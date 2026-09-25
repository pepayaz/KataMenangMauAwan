# packages/verifiers

Verifier per tipe klaim (bab 4). **Pemilik: B.** Reviewer: A.

Bentuk setiap berkas verifier selalu sama dan wajib dipertahankan:

1. Satu atau beberapa fungsi `compute*` yang **murni**: masukannya data mentah
   Sectors yang sudah diambil, keluarannya angka. Tidak ada `await`, tidak ada
   akses klien. Semua uji unit menyasar fungsi-fungsi ini.
2. Satu fungsi verifier yang mengambil data lewat `ctx.client`, lalu memanggil
   fungsi murni di atas.

Pemisahan ini yang membuat "uji unit berbasis data cache" mungkin: uji tidak
perlu jaringan maupun Supabase.

Aturan lain:
- Verifier tidak pernah memutuskan verdict. Ia mengembalikan angka terhitung dan
  `matches`; pemetaan ke status ada di adjudicator (A, bab 3.5).
- Setiap angka yang dikembalikan wajib punya `Evidence` dengan `evidenceId` yang
  deterministik, supaya evaluasi bisa diulang dan grounding validator punya
  sesuatu untuk dicocokkan.
- Data yang tidak tersedia bukan kegagalan: kembalikan `matches: null` dengan
  catatan, biar adjudicator menandai `unverifiable`.
