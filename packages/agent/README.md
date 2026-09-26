# Grounding

`validateGrounding(text, evidence)` mengembalikan `{ ok, unmatched }` dengan
span UTF-16 `[awal, akhir)`. Angka ambigu, invalid, atau digit yang tidak berhasil
dibaca parser ditolak. Evidence string harus merupakan satu ekspresi angka lengkap.

Evidence numerik memakai satuan dasar: IDR utuh, jumlah saham utuh, kelipatan,
dan persen sebagai pecahan (`0.255` = `25,5%`). Evidence string `25,5%` juga diterima.
Nilai numerik `%` dari verifier harga/pertumbuhan yang masih memakai poin persen
harus diubah menjadi pecahan di adapter sebelum memakai validator ini. Validator
tidak menebak skala persen dari besar angka. Angka bersatuan tidak dicocokkan
dengan evidence bersatuan lain; satuan evidence yang kosong berarti tidak diketahui.

Pembulatan mengikuti digit mantissa yang ditampilkan, dengan aturan setengah
menjauh dari nol. Tidak memakai toleransi relatif atau mencoba skala sembarang.

`groundingExclusions(text)` menampilkan pengecualian secara eksplisit: tanggal
kalender valid (ISO, numerik Indonesia, nama bulan Indonesia), tahun dengan
konteks waktu atau satu tahun sebagai seluruh teks, rentang tahun, durasi positif
seperti `5 tahun`, serta `Q1` sampai `Q4`. Ini pengecualian format temporal;
ketepatan periode harus diperiksa oleh pipeline. Harga `Rp2024`, `2024 saham`,
dan `2024%` tetap harus didukung evidence.

`withGrounding(writeFn, evidence, templateFn)` menghasilkan `Promise<string>`.
Penulisan pertama menerima `undefined`; penulisan kedua menerima
`{ previousText, unmatched }`. Sesudah dua kegagalan, template dipanggil dengan
evidence. Template juga divalidasi; hasil template yang gagal menimbulkan
`GroundingError`, sehingga angka karangan tidak dikembalikan ke UI.

## Adjudicator

`adjudicate(claim, verifier, hypotheses)` adalah fungsi murni yang menghasilkan
`Omit<ClaimVerdict, 'explanation'>`. `VERDICT_DECISION_TABLE` memuat aturan dan
prioritas sebagai data. `verifier.matches` adalah hasil perbandingan deterministik
terhadap toleransi; teks `tolerance` tidak ditafsirkan ulang.

Input kompatibel dengan `VerifierOutput`, ditambah dukungan null di batas input
mentah tanpa melonggarkan skema publik Evidence. Null, string kosong, NaN, dan
Infinity tidak dihitung sebagai data. Minimal satu evidence numerik milik klaim
harus tersedia. Jika computed diberikan, anchor-nya wajib merujuk evidence numerik
yang valid; computed null atau tidak valid menghasilkan unverifiable. Null pada
evidence lain tidak membatalkan anchor numerik yang valid. Nol adalah data valid.

Konteks harus terpicu, strong, milik klaim yang sama, dan semua ID evidence-nya
harus tersedia serta tidak kosong. Hanya konteks tersebut yang masuk missingContext.
Refuted lebih dahulu daripada misleading. Safety dengan angka cocok tanpa konteks
strong menjadi unverifiable; dengan konteks strong menjadi misleading. Prediksi
lebih dahulu daripada aturan data kosong dan tidak membawa computed/evidence.
Penjelasan ditambahkan terpisah sesudah status ditentukan dan harus lolos grounding.

## LLM dan extractor

`LlmAdapter` memakai `LLM_PROVIDER`, `LLM_MODEL`, dan `LLM_API_KEY` dari env.
Tidak ada model/key live bawaan. Provider tersedia: `openai` melalui Responses API
dan `mock` tanpa jaringan; provider lain dapat mengimplementasikan `LlmProvider`
dan disuntikkan dengan nama yang sesuai env. SDK OpenAI menghasilkan JSON schema
dari Zod melalui `zodTextFormat`. Keluaran tetap divalidasi Zod di adapter.
Lihat [Structured Outputs resmi](https://developers.openai.com/api/docs/guides/structured-outputs).
Schema wire memakai field nullable yang wajib hadir agar sesuai mode strict.
Root schema wajib object; subset mendukung object, array, union, nullable, enum,
literal JSON, string, number, dan boolean. Fungsi, date, optional, atau transform
ditolak sebelum panggilan agar konverter SDK tidak menghilangkan field diam-diam.

JSON/schema gagal -> satu retry dengan path/kode validasi -> `LlmError`.
Error konfigurasi, jaringan, refusal, atau respons incomplete tidak di-retry.
SDK automatic retries dimatikan. Error tidak memuat key, respons mentah, atau pesan
provider. Respons live memakai `store: false`; model env harus mendukung structured output.

`extractClaims(text, entities, { checkId, llm, onRejected? })` menghasilkan Claim[].
`extractClaimsWithDiagnostics` menghasilkan `{ claims, rejected }` untuk menyimpan
alasan penolakan; callback menerima alasan yang sama. Gunakan diagnostics/callback
saat menyambungkan trace pipeline. Prompt dibaca dari `prompts/extractor.md` dan
few-shot mengikuti tiga fixture shared. Belum menggantikan pipeline dasar backend.

Payload LLM lokal memiliki quote persis, span UTF-16, dan tickers[]. Setelah Zod,
kode memeriksa rentang/quote, ticker dalam entities dengan confidence >= 0,7,
angka/satuan literal melalui number-id, dan periode/window yang benar-benar tertulis.
Span yang memotong token angka ditolak. LLM mengisi mantissa tanpa menghitung:
kode menormalkan Rp2,4 T menjadi IDR utuh, sementara 25,5% tetap 25.5 pada Claim.
Angka ambigu tidak diterima sebagai nilai. Klaim dua ticker menjadi dua Claim
dengan span sama. ID dibuat kode; duplikasi dibuang. Aturan prediksi/opini eksplisit
juga mengoreksi inScope menjadi false. Pemeriksaan semantik atom/metrik tetap
bagian ekstraksi LLM; validator kode tidak mengklaim memahami semua ragam opini.

## Normalizer dan router

`normalizeText(raw, { directory?, llm?, unresolvedSurfaces? })` menghasilkan teks
bersih, entities yang sudah mencapai confidence 0,7, serta status `ready` atau
`needs_user_choice` dan `choices[]`. Span extractor mengacu teks bersih ini.
Resolver eksplisit/alias memakai fungsi B di shared. Kode bertanda yang tidak
ada di directory tidak diteruskan, meski resolver B sendiri menerimanya. Alias
bentrok dan confidence rendah mengembalikan kandidat untuk konfirmasi pengguna.
Entitas lain yang pasti tetap tersedia, tetapi caller harus menangani status
pilihan sebelum meneruskan pipeline. Teks tanpa sebutan saham menghasilkan
entities kosong; ini berbeda dari ticker yang ditemukan tetapi belum pasti.

`TickerDirectory` menerima daftar emiten, alias hasil `loadAliases(db)` milik B,
dan fungsi search. TODO(B) pada `createFixtureTickerDirectory` menandai seed emiten
demo dan fuzzy sementara berbasis edit distance terhadap ticker/alias manual.
Daftar ini belum mencakup seluruh bursa. Deteksi otomatis fuzzy sementara memakai
token tunggal; `unresolvedSurfaces` menerima nama multi-kata dari caller.
LLM memilih hanya dari maksimal sepuluh kandidat yang valid, unik, dan sudah
diurutkan. Pilihan di luar daftar, null, confidence rendah, atau error menjadi
pilihan pengguna. Tidak ada panggilan live Sectors untuk memuat directory.

`routeClaim(claim, { today, window?, isCached?, subSector? })` adalah fungsi murni.
`CLAIM_ROUTE_TABLE` mengatur tujuh tipe; tools memakai nama dan params klien B,
estimasi kredit memakai `estimateCredits` B, dan `isCached` diberikan oleh caller
sesudah memeriksa cache/TTL. Estimasi tidak memberikan izin menjalankan mode live.
Rencana dasar hanya menarik section valuation, dividend, atau overview yang
dibutuhkan verifier. Panggilan hipotesis, seperti peers dan corporate-actions
dividen, ditambahkan Context Hunter dari requiredTools, bukan ditarik semuanya.

Jendela adalah hari kalender inklusif mengikuti verifier B: harga 30 hari,
foreign flow 20 hari, broker 14 hari jika tidak disebutkan. Bawaan dicatat di
notes; hari perdagangan tidak diasumsikan. Rentang eksplisit dapat diberikan lewat
window atau teks ISO `awal sampai akhir`. Jendela tidak dikenal/invalid/future
memerlukan pilihan pengguna. YTD dimulai 1 Januari, bukan hasil parseWindowPhrase
B yang menyamakan YTD dengan 365 hari. Harga/foreign dipecah setiap 90 hari;
broker setiap 14 hari, tanpa gap/overlap. Komposisi meliputi semua tahun rentang.
Laba memakai lima kuartal seperti verifier B, dengan report_date jika periode
Q1–Q4 atau tanggal ISO disebutkan; periode lain memerlukan konfirmasi.
Safety memakai overview, suspensions, corporate-actions, dan free-float. Tanpa
subSector, estimasi daftar free-float penuh konservatif 10 kredit dari B; dengan
subSector yang sudah diketahui menjadi 2 kredit. Tidak mengarang filter simbol.
Modul ini belum menggantikan pipeline dasar backend atau mengeksekusi ToolCall.
