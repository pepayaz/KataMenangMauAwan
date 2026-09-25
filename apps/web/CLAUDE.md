# apps/web

Next.js App Router: UI (C) dan route handler API (B).

Pembagian di dalam paket ini:
- `app/api/**` dan `lib/**` — **B**. Route cek, streaming SSE, riwayat, kredit, persistensi.
- `app/page.tsx`, `app/share/`, `app/history/`, komponen UI — **C**.
- `app/admin/credits` — **B**, dasbor internal.

Aturan:
- Route handler tidak pernah memanggil Sectors langsung; selalu lewat `@cek-dulu/sectors`.
- Penulisan ke Supabase memakai service role dan hanya terjadi di server.
- Setiap tahap pipeline mengirim `TraceEvent` ke SSE sebelum dan sesudah kerjanya,
  supaya panel jejak di UI tidak pernah membeku (bab 3.8).
