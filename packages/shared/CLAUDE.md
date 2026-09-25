# packages/shared

Kontrak data bersama (bab 5 rencana). **Pemilik: A.** Reviewer: B, C.

Aturan:
- Semua tipe antar-tahap dan antar-anggota hidup di sini sebagai skema Zod. Tidak ada
  paket lain yang boleh mendefinisikan ulang `Claim`, `Evidence`, `ClaimVerdict`, atau `TraceEvent`.
- Perubahan kontrak wajib diikuti pembaruan berkas ini dalam PR yang sama.
- Paket ini murni: tidak ada I/O, tidak ada `fetch`, tidak ada akses Supabase.
