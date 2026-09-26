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
