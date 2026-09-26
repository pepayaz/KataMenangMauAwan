# packages/shared

Kontrak data bersama (bab 5 rencana). **Pemilik: A.** Reviewer: B, C.

Aturan:
- Semua tipe antar-tahap dan antar-anggota hidup di sini sebagai skema Zod. Tidak ada
  paket lain yang boleh mendefinisikan ulang `Claim`, `Evidence`, `ClaimVerdict`, atau `TraceEvent`.
- Perubahan kontrak wajib diikuti pembaruan berkas ini dalam PR yang sama.
- Paket ini murni: tidak ada I/O, tidak ada `fetch`, tidak ada akses Supabase.

## Fondasi shared

- Kontrak mengikuti AGENTS.md bagian 7, termasuk input `screenshot`.
- `ToolCall` berisi `tool` (nama metode klien Sectors) dan `params`.
- `HypothesisSchema` memvalidasi metadata serta argumen/hasil fungsi sinkron `test`;
  fungsi lokal ini tidak diserialisasi sebagai output LLM.
- `parseNumber` membaca satu ekspresi, `extractNumbers` membaca teks bebas.
  `value` mempertahankan angka sebelum skala; `normalized` mengubah persen ke pecahan
  dan skala ke satuan dasar. `raw` persis sama dengan potongan teks pada span UTF-16.
  Hasil ambigu tidak mempunyai nilai numerik dan ditandai `ambiguous: true`.
  Jangan menganggap `1.358`, `1,358`, atau singkatan `M` pasti mempunyai satu makna.
- `parseIndonesianNumber` adalah pembantu skalar kompatibel: invalid/ambigu -> null.
- Fixture ADRO bersumber dari AGENTS.md bagian 6; fixture PER menggunakan data sintetis,
  dan fixture prediksi sengaja tidak memiliki evidence maupun pengujian hipotesis.
