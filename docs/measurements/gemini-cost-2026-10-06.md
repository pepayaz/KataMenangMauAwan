# Pengukuran Gemini — 6 Oktober 2026

Model: `gemini-3.5-flash`, konfigurasi aplikasi web. Pengujian benar-benar memanggil
Gemini berbayar. Sectors tetap offline/cache_only, memakai verifier/evidence fixture
kontrak (BBCA PER 3x adalah angka sintetis, bukan data pasar BBCA saat ini).

## Hasil cold cache

| Kasus | Sebelum (USD) | Sesudah (USD) | Penurunan estimasi | Verdict |
|---|---:|---:|---:|---|
| ADRO yield 25,5% setahun | 0.027259 | 0.011627 | 57.3% | misleading → misleading |
| BBCA PER cuma 3x | 0.025773 | 0.010572 | 59.0% | supported → supported |
| BBRI bakal naik 80% | 0.015488 | 0.009691 | 37.4% | out_of_scope → out_of_scope |
| Total | 0.068520 | 0.031890 | 53.5% | Ketiganya tetap sama |

- Panggilan HTTP: 8 → 8. Penghematan cold cache berasal dari pengurangan token, bukan menghapus tahap.
- Input tokens: 5630 → 5630.
- Output tokens: 710 → 661.
- Thinking tokens: 5965 → 1944.
- Durasi tiga kasus: 34.08 → 20.10 detik (41.0% lebih singkat pada sampel ini).
- Grounding lulus pada seluruh hasil. Tidak ada error tahap atau fallback templat.
- Jenis klaim, ticker, nilai, unit, dan inScope tetap sama. Label metric prediksi bervariasi (`naik` vs `price move`), tetapi semantiknya sama.
- Kredit Sectors: 0.

## Pengulangan dan cache

Exact-repeat memakai checkId sama dan berhasil tanpa panggilan HTTP. Ini batas atas
manfaat cache, bukan perilaku biasa UI yang membuat checkId baru.

Uji tambahan ADRO dengan checkId baru seperti UI:
- Cold: 3 panggilan, USD 0.0111405, 7.44 detik.
- Pemeriksaan baru: 2 panggilan, USD 0.0042705, 3.35 detik.
- Hanya ekstraksi yang cache hit; hunter dan penjelasan tetap dipanggil.
- Kedua verdict `misleading`; penjelasan tetap lolos grounding.

Total seluruh benchmark: 21 panggilan,
estimasi USD 0.115821.

## Metode dan keterbatasan

Pipeline, prompt, fixture, dan model sama. Baseline menonaktifkan cache lokal serta
menghapus pengaturan thinking/output baru dari request; komponen lain memakai kode
yang sama. Urutan baseline → optimized cold → exact repeat. Sampel hanya satu kali
per kasus; latensi/token dapat bervariasi dan urutan uji dapat memengaruhi cache
implisit Google. Pengukuran ini bukan jaminan penghematan untuk semua input atau
bukti akurasi seluruh produk. Tidak menguji video, screenshot, multi-claim panjang,
resolusi ticker fuzzy, maupun kualitas data Sectors terbaru.

Biaya adalah estimasi dari usageMetadata Gemini, termasuk thinking dan diskon
cached input provider bila dilaporkan. Tarif Standard: input USD 1.50/juta token,
cached input USD 0.15/juta token, output+thinking USD 9.00/juta token.
[Sumber tarif resmi](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash).
Tidak termasuk pajak, kurs rupiah, kredit/promosi atau penyesuaian billing account.
Token response cached lokal tidak ditagihkan oleh Gemini karena tidak ada request.

Data mentah aman: [benchmark utama](gemini-cost-2026-10-06.json),
[pengulangan dengan ID baru](gemini-new-check-2026-10-06.json). Laporan tidak berisi
API key, header auth, media pengguna, atau respons provider mentah.

Skrip `scripts/measure-llm.ts` hanya berjalan dengan flag `--live-gemini`, bukan
bagian pnpm test. Flag tambahan `--new-check-repeat` mengukur ulang ADRO dengan ID baru.
Skrip membaca env aplikasi web dan dibatasi 24 HTTP request per proses serta berhenti
sebelum request berikutnya bila estimasi biaya tercatat mencapai USD 0.50. Ini bukan
hard cap provider; satu request terakhir dan request gagal tanpa usage metadata bisa
membuat biaya billing berbeda. Jangan menjalankan berulang tanpa kebutuhan.
