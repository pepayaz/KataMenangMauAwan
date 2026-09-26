# Sambungan pipeline ke web

`POST /api/check` memakai adapter `createPipeline` -> `runCheck`. Verifier B, cache,
ledger, flags, alias, persistensi dan nama event SSE tetap dipakai. Route ini memaksa
Sectors `cache_only`; tidak mengambil data live.

## Kontrak untuk UI C

Body: `{ text, source?: "paste", url?, demo?: false }`. Header respons `X-Check-Id`.
Baca body streaming dengan fetch (POST), bukan EventSource (GET). Event `trace`
berisi TraceEvent; `result` berisi CheckResult, bukan array verdict langsung;
`error` berisi `{ checkId, message }`; `ping` boleh diabaikan. Trace stage `done`
bukan event terminal. Terminal tepat satu `result` atau `error`.
`readCheckStream` memvalidasi Zod, identitas cek, potongan UTF-8/CRLF, dan koneksi
terputus. Grounding tampil sebagai `adjudicate` dengan `data.step = "grounding"`.
Jumlahkan kredit tahap; event done memiliki kredit nol dan total pada data.

## Ketidaksesuaian dan alasan perubahan B/C

- B masih memilih BaselinePipeline: factory diganti adapter agen, dependency dan
  transpile config ditambahkan supaya Next dapat memakai TypeScript paket agent.
- Emitter B mengganti timestamp agen: sekarang timestamp asli dipertahankan,
  sehingga event UI dan persistensi identik.
- Field pilihan `ticker` milik B belum terhubung ke surface normalizer. Sekarang
  ditolak eksplisit HTTP 400; gunakan kode eksplisit pada teks. Trace normalize
  menampilkan `needs_user_choice` dan kandidat; kontrol pemilihan masih perlu C.
- Tidak ada implementasi UI C pada branch yang tersedia setelah git fetch.
  Placeholder diganti form/rapor minimal untuk menguji sambungan; komponen ini
  merupakan UI sementara, bukan verifikasi terhadap UI C yang belum tersedia.
- Ekspor utama shared membawa node:crypto (claim-hash) ke bundle browser:
  ekspor `shared/schemas` ditambahkan agar validator UI hanya mengimpor kontrak.
- URL asset markdown Next tidak cocok untuk fs.readFile: adapter memuat prompt
  sumber dan menyuntikkannya; outputFileTracingIncludes menyertakan prompt.
- Route menutup stream aman jika pembaca disconnect. Pipeline tetap menyelesaikan
  cek dan persistensi seperti kebijakan emitter B; signal belum membatalkan kerja agen.
- Error provider tidak disebarkan mentah. UI menerima pesan kegagalan terkontrol.

## Demo UI tanpa jaringan

PowerShell: `$env:CHECK_FIXTURE_DEMO="1"; $env:SECTORS_MODE="cache_only"; pnpm dev`.
Buka localhost:3000, teks `ADRO yield 25,5% setahun`, centang demo fixture, kirim.
Mode ini ditandai di UI, hanya menerima tiga teks fixture shared, memakai mock LLM,
verifier dan gateway hunter dari demo CLI, menjalankan runCheck sungguhan, memakai
0 kredit, tidak menyimpan ke Supabase, dan selalu ditolak di produksi. Ia tidak
menyediakan atau mengklaim cache respons Sectors asli. Demo tidak menggantikan
mode normal secara otomatis.

Cache Sectors dan .env.local tidak tersedia pada checkout yang diuji. Pemeriksaan
ADRO dengan data asli perlu LLM_PROVIDER, LLM_MODEL, LLM_API_KEY dan cache B untuk
fetchCompanyReport({symbol:"ADRO", sections:["dividend"]}) (perkiraan 1 kredit jika
kelak diminta live). DIV_TTM_GAP juga memerlukan corporate-actions (perkiraan 1).
Kunci cache persis penting: rekaman gabungan overview/valuation/dividend tidak
cocok dengan permintaan section dividend saja. Tidak ada panggilan live dijalankan.

## Hasil pengujian 26 September 2026

Browser UI lokal: `ADRO yield 25,5% setahun`, checkbox demo fixture aktif.
Delapan trace diterima: normalize, extract, route, verify, hunt, adjudicate,
adjudicate/grounding, done. Event result menampilkan satu klaim misleading,
DIV_CASH_PAYOUT strong, penjelasan angka 25,5%, sekitar 23,6%, Rp1.358,18,
45,2% lolos grounding. Total 0 kredit. Bukan pemeriksaan cache Sectors asli.
`pnpm test`: 597 test / 22 file lulus. `pnpm -r typecheck`: lulus.
