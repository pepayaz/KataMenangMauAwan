# Integrasi backend, agen dan UI

Branch `feat/integration-core` menggabungkan shared-foundation A dan frontend C
(yang sudah berbasis backend B). Aplikasi utama adalah Next.js di `apps/web`;
`frontend/` tetap menyimpan aplikasi Vite asal C sebagai referensi desain.

## Jalankan demo offline

```bash
pnpm install
pnpm dev:demo
```

Buka http://localhost:3000 dan centang **Demo fixture offline**. Pilih contoh:

- `ADRO yield 25,5% setahun`: misleading.
- `BBCA PER cuma 3x`: supported.
- `BBRI bakal naik 80%`: out_of_scope.

Demo memakai runCheck dan SSE sungguhan dengan mock offline, 0 kredit, tanpa
Sectors live dan tanpa persistensi Supabase. Mode ini eksplisit dan ditolak di
produksi. Bookmark dan riwayat lokal dapat dibuka setelah reload; rapor tetap
berlabel demo. Fixture bukan bukti bahwa data pasar saat ini tersedia.

## Jalankan pemeriksaan normal

PowerShell:

```powershell
Copy-Item .env.example apps/web/.env.local
pnpm dev
```

Isi LLM_PROVIDER=openai, LLM_MODEL dan LLM_API_KEY di file lokal tersebut.
Sediakan cache respons B di `.cache/sectors` pada root repo atau atur
SECTORS_CACHE_DIR ke lokasi cache (disarankan absolut). Kunci cache harus cocok
dengan endpoint dan params, termasuk section yang diminta router. Default web
selalu cache_only: cache miss tidak menyebabkan panggilan live.

Jika memakai Supabase, isi URL, anon key dan service role key dari environment
lokal, lalu terapkan migrations B melalui prosedur backend. Riwayat server
membutuhkan sesi Supabase yang sah; tanpa sesi, UI menjelaskan bahwa riwayat
tersimpan hanya di perangkat. Integrasi ini tidak menambahkan layar login baru.

## Perubahan kontrak dan alasan

- UI C memakai timer dan rapor demonstrasi. Workspace Next menggantinya dengan
  POST/SSE tervalidasi; CheckResult memuat semua klaim/evidence/konteks, sehingga
  UI tidak menentukan verdict sendiri.
- Trace done belum terminal; UI menunggu event result/error. Kredit ditampilkan
  dari trace dan total hasil backend. Pembatalan tampilan belum membatalkan
  seluruh pekerjaan server, dan dijelaskan di UI.
- Riwayat SQL B memakai snake_case dan span int4range. Route detail menambah
  CheckResult hasil adapter Zod, mempertahankan field lama serta kontrol akses.
- C menyimpan id demo pada riwayat. UI terintegrasi menyimpan hasil lengkap yang
  tervalidasi, bookmark dan trace, maksimal 50 rapor di perangkat.
- Cwd Next berbeda dari CLI. Cache web diarahkan ke root repo agar kedua alur
  membaca cache berkas yang sama.

## Verifikasi dan batas

Jalankan `pnpm test`, `pnpm -r typecheck` dan `pnpm build`. Setelah build,
`pnpm --filter @cek-dulu/web start` menjalankan produksi dengan environment yang
sudah dikonfigurasi; demo fixture tidak aktif di produksi.

Pada mesin yang diuji 26 September 2026, file env lokal, process env LLM/Supabase,
direktori cache standar dan rekaman demo tidak ditemukan. Jadi cek data asli
dan persistensi/auth Supabase nyata belum diverifikasi. Kode diuji dengan mock
serta browser lokal; tidak ada panggilan Sectors live. ADRO normal membutuhkan
company-report section dividend (perkiraan 1 kredit jika kelak diizinkan live),
serta corporate-actions untuk konfirmasi DIV_TTM_GAP (perkiraan 1 kredit).
Pemanasan cache perlu izin eksplisit; jangan menjalankannya sebagai unit test.

Hasil akhir: `pnpm test` 630 test / 23 file lulus, `pnpm -r typecheck`
lulus, dan build produksi Next.js lulus. Browser memverifikasi ketiga fixture,
8 event trace per cek, bookmark ADRO bertahan setelah reload, serta error
terkendali ketika cek normal dijalankan tanpa konfigurasi LLM.
