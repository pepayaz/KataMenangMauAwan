# packages/sectors

Satu-satunya jalan ke Sectors API. **Pemilik: B.** Reviewer: A.

Aturan keras (bab 6.1 rencana):
- Tidak ada berkas di luar paket ini yang boleh memanggil `api.sectors.app`, langsung
  maupun lewat `fetch`. Kalau butuh endpoint baru, tambahkan metode bertipe di `client.ts`.
- Nama metode mengikuti nama alat di dokumentasi Sectors (`fetchCompanyReport`,
  `fetchForeignFlow`, dan seterusnya) supaya mudah dicocokkan saat review.
- Cache diperiksa sebelum memanggil. Setiap panggilan dicatat ke buku kredit,
  termasuk yang dilayani cache (dengan `credits: 0`).
- Tiga mode lewat `SECTORS_MODE`: `live`, `cache_only` (tidak pernah memanggil API),
  `replay` (memutar rekaman untuk demo).
- Panggilan ditolak bila anggaran cek atau anggaran anggota terlampaui.

Batas jendela yang ditegakkan klien: foreign flow dan daily maksimal 90 hari per
panggilan, broker summary maksimal 14 hari. Jendela yang lebih panjang dipecah
otomatis dan kreditnya dihitung di muka lewat `estimateCredits`.
