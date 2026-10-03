# Sambungan pipeline ke web

`POST /api/check` memakai adapter `createPipeline` -> `runCheck`. Verifier B, cache,
ledger, flags, alias, persistensi dan nama event SSE tetap dipakai. Route ini memaksa
Sectors `cache_only`; tidak mengambil data live.

## Kontrak untuk UI C

Body: `{ text, source?: "paste", url?, demo?: false, userSelections?: [{surface, ticker}] }`. Header respons `X-Check-Id`.
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
  menampilkan `needs_user_choice` dan kandidat; UI sementara sekarang menyediakan
  pilihan surface-ticker, diteruskan melalui `userSelections`. Kandidat dihitung
  ulang di normalizer server; kiriman UI tidak dapat menambah ticker sendiri.
- Branch frontend kini tersedia dan digabung ke feat/integration-core. Desain C
  dipindahkan dari aplikasi Vite mandiri ke apps/web/components. Simulasi timer dan
  rapor buatan UI diganti POST/SSE serta CheckResult tervalidasi dari backend;
  seluruh klaim ditampilkan, bukan hanya klaim pertama. Folder frontend tetap
  tersedia sebagai sumber desain; panduan akhir ada di integration.md.
- Ekspor utama shared membawa node:crypto (claim-hash) ke bundle browser:
  ekspor `shared/schemas` ditambahkan agar validator UI hanya mengimpor kontrak.
- URL asset markdown Next tidak cocok untuk fs.readFile: adapter memuat prompt
  sumber dan menyuntikkannya; outputFileTracingIncludes menyertakan prompt.
- Route menutup stream aman jika pembaca disconnect. Pipeline tetap menyelesaikan
  cek dan persistensi seperti kebijakan emitter B; signal belum membatalkan kerja agen.
- Error provider tidak disebarkan mentah. UI menerima pesan kegagalan terkontrol.

## Demo UI tanpa jaringan

Jalankan `pnpm dev:demo` (mengaktifkan CHECK_FIXTURE_DEMO=1 dan cache_only).
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

## Penyelesaian pilihan pengguna

`userSelections` merupakan opsi resolusi, bukan perubahan CheckInput/CheckResult.
Normalizer memvalidasi bentuk input, keunikan surface, dan kecocokan kandidat
berdasarkan teks/directory saat ini. Pilihan sah menghasilkan Entity method user
confidence 1 dan tidak memanggil LLM untuk memilih surface yang sama lagi.
Pilihan palsu/teks berubah menghasilkan trace error INVALID_USER_SELECTION.
Pilihan parsial tetap meminta surface lainnya. UI menghapus pilihan ketika teks
berubah, menampilkan dropdown kandidat, dan mengirim ulang cek setelah dipilih.
Legacy `ticker` tunggal tetap ditolak karena tidak mengidentifikasi surface.

Perubahan B/C tambahan hanya meneruskan userSelections pada context route/factory
serta kontrol pilihan pada UI sementara. Skema shared tidak berubah. Filter kata
umum pada fuzzy mencegah bakal menjadi kandidat alias bara; alias eksplisit tetap
diprioritaskan. Test server memeriksa putaran pertanyaan -> pilihan -> result.
Test total terbaru: 613 lulus; typecheck lulus.

## Integrasi desain C dan riwayat B

Route GET /api/history/[checkId] sebelumnya mengirim baris SQL snake_case yang
tidak cocok dengan CheckResult. Adapter stored-check memulihkan span int4range,
entities dari trace, evidence, hipotesis dan verdict menjadi skema shared; route
menambah field result, mempertahankan payload lama, dan memberi checkId pada trace.
Error query/kontrak tidak ditampilkan sebagai rapor kosong. Autentikasi dan
pembatasan kepemilikan B tetap dipakai. Header sesi Supabase diteruskan pada cek
normal dan permintaan riwayat. Login baru belum menjadi bagian integrasi P0.

Riwayat anonim menyimpan hasil lengkap di perangkat, maksimal 50, divalidasi saat
dibaca kembali. Mode normal tetap memerlukan LLM dan cache; tidak otomatis
beralih ke fixture. GET /api/check memberi indikator konfigurasi LLM tanpa key.
Cache web sekarang memakai direktori root yang sama dengan CLI.
