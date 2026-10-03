# KONTEN — Cek Dulu

Status: Fase 1 disetujui untuk dilanjutkan melalui pesan “lanjut”; inventaris menjadi dasar fase desain berikutnya.

Inventaris ini mengambil konten dari implementasi pada branch `feat/ui-investigation-console`, commit `e744995`, kontrak proyek, dan permintaan pengguna. Teks antarmuka yang dikutip di bawah adalah teks yang sudah ada, bukan slogan baru. Tidak ada perubahan UI atau backend pada fase ini.

## Brief

| Variabel | Isi |
|---|---|
| Proyek | Cek Dulu, pemeriksaan klaim saham Indonesia dari media sosial |
| Subjek | Klaim, angka pembanding, konteks yang hilang, dan bukti; bukan penilaian kreator |
| Pengguna | Orang yang menemukan klaim saham dan ingin memahami kesesuaiannya dengan data; tidak diasumsikan paham istilah pasar |
| Tugas utama | Memasukkan konten, meninjau hasil pembacaan, memeriksa klaim, memahami status dan menelusuri bukti |
| Platform | Website desktop/mobile dan PWA yang sudah ada |
| Layar | Pemeriksaan, tinjauan media, pemilihan saham, progres, rapor, sumber, riwayat, tersimpan, panduan, Tentang |
| Identitas | Logo Cek Dulu yang disukai pengguna dipertahankan; Bahasa Indonesia |
| Arah dari pengguna | Tema gelap, warna lebih berkarakter, komponen interaktif, ukuran font konsisten, sedikit teks berdekatan; tanpa glassmorphism |
| Batas teknis | Pertahankan fungsi backend, kontrak data, grounding, sumber asli, dan disclaimer permanen |
| Waktu | Hackathon diperpanjang sekitar satu minggu. [KONFIRMASI] Tanggal dan jam pengumpulan yang baru belum diberikan |
| Biaya | Tidak ada biaya tambahan, ditafsirkan sebagai penggunaan aset/alat gratis atau yang sudah tersedia; tidak memasang layanan berbayar |
| Referensi | Referensi lama belum dianggap sebagai pilihan untuk siklus desain ini. Pemilihan dilakukan di Fase 2 |

Kompas layar pertama — [USUL UNTUK DISETUJUI, bukan copy hero]: pengguna segera mengetahui tempat memasukkan klaim saham, memilih bentuk input, dan melihat tindakan berikutnya.

## Prioritas konten

1. Input: satu tindakan berikutnya yang jelas; teks bantuan muncul sesuai kebutuhan.
2. Rapor: kesimpulan terlihat dahulu, kemudian angka pembanding dan alasan konteks.
3. Sumber: grafik berdasarkan bukti yang benar-benar tersedia, dengan akses ke setiap nilai dan asalnya.
4. Riwayat, tersimpan, panduan, dan Tentang: mendukung pemeriksaan tanpa bersaing dengan tugas utama.

Hierarki ini adalah kebutuhan konten, bukan persetujuan bentuk layout, warna, atau komponen. Nilai, peringatan, dan penjelasan tidak dihapus untuk mempersingkat tampilan.

## Alur utama dan keadaan yang harus tercakup

1. Pilih teks, screenshot, link video, atau unggah video.
2. Untuk media, jalankan pembacaan lalu tinjau dan koreksi teks, ticker, serta angka. Teks biasa langsung dapat diedit.
3. Jika identitas saham ambigu, pilih kandidat atau tandai bukan saham sebelum memeriksa kembali.
4. Jalankan pemeriksaan; tampilkan progres dari trace aktual, bukan persentase buatan.
5. Baca status per klaim, angka pembanding, dan konteks. Kegagalan satu klaim tidak boleh disamarkan sebagai kesimpulan klaim lain.
6. Buka sumber; telusuri grafik dan bukti yang mendasarinya, periode, rumus bila tersedia, serta waktu pengambilan.
7. Simpan atau buka kembali rapor bila diperlukan. Rapor lama tidak dipresentasikan sebagai pemeriksaan baru.

Keadaan wajib: kosong, sedang membaca, hasil pembacaan, pembacaan tidak lengkap, berkas invalid, platform membatasi akses, server belum dikonfigurasi, sedang memeriksa, saham ambigu, tidak ada klaim, data tidak cukup, error, hasil berhasil, dan riwayat kosong.

## Pemeriksaan dan input

- Judul layar: “Periksa klaim saham”. Judul area: “Masukkan klaim”.
- Pilihan: “Teks”, “Screenshot”, “Link video”, “Unggah video”.
- Placeholder teks: “Contoh: ADRO yield 25,5% setahun”. Batas teks aktual: 5.000 karakter.
- Tindakan utama: “Cek klaim ini”; keadaan sibuk: “Memeriksa...”.
- Contoh yang sudah ada: “ADRO yield 25,5% setahun”, “BBCA PER cuma 3x”, “BBRI bakal naik 80%”. Klik contoh mengisi editor; tidak menjalankan pemeriksaan otomatis.
- Rapor terdahulu, bila tersedia: “Rapor terakhir”, “Buka rapor”.
- Konfigurasi belum siap: “Pemeriksaan belum tersedia. Konfigurasi AI dan data tersimpan perlu disiapkan di server. Contoh offline dapat dipakai untuk mencoba alur.”
- Pembatalan tampilan: “Batalkan tampilan”. Jangan menjanjikan pembatalan seluruh pekerjaan server dari label ini.

### Media

- Urutan aktual: “Baca”, “Tinjau”, “Cek”.
- Field: “Tautan video publik”. Placeholder: “Tempel link TikTok, YouTube, atau video publik lain”.
- Pilihan berkas: “Pilih screenshot”, “Pilih berkas video”.
- Tindakan penting: “Baca teks screenshot”, “Baca isi video”, “Baca ulang”.
- Keadaan sibuk: “Membaca screenshot…”, “Membaca video…”.
- Bantuan: “Info pembacaan”; “Audio dan tulisan pada video dibaca. Jika platform membatasi akses, gunakan unggah video, screenshot, atau teks.”
- Privasi: “Privasi berkas”; “Konten dikirim ke penyedia AI untuk pembacaan dan tidak disimpan dalam riwayat. Hapus bagian pribadi sebelum mengunggah.”
- Batas berkas pada UI saat ini: PNG/JPEG/WebP maksimal 3 MB; MP4/WebM maksimal 4 MB. Ini batas implementasi, bukan usulan peningkatan kapasitas.
- Pembacaan tidak lengkap: “Pembacaan belum lengkap. Tempel teks klaim di bawah untuk melanjutkan.”
- Tinjauan: “Tinjau hasil pembacaan”, “Periksa saham dan angka”, “Catatan pembacaan”, “Dapat diedit”.
- Sumber link: “Sumber”, “Lepas link”. Pertahankan URL konten, tanpa menjadikan kreator subjek penilaian.
- Angka yang terdeteksi membantu memilih bagian editor untuk koreksi; deteksi bukan bukti bahwa angka benar.

[KONFIRMASI TEKNIS] Keberhasilan pembacaan tiap platform bergantung pada akses dan konfigurasi. Tidak ada janji semua link selalu berhasil. Jangan menyebut seluruh video terbaca jika hanya caption yang tersedia.

### Pemilihan saham dan progres

- “Pilih saham yang dimaksud, lalu cek kembali”, “Sebutan “{surface}””, “Pilih saham”, “Bukan saham”.
- Tanpa kandidat: “Tidak ada kandidat; pilih “Bukan saham” atau tulis kode saham eksplisit.”
- Judul progres: “Memeriksa klaim”. Tahap dan kredit berasal dari TraceEvent aktual.

## Rapor pemeriksaan

- Judul: “Hasil pemeriksaan”. Tindakan: “Simpan rapor”, “Tersimpan”.
- Label contoh: “Contoh historis”, “Demo fixture offline”.
- Batas interpretasi: “Angka contoh bukan data pasar terkini.” atau “Berdasarkan data dan periode yang tersedia.” sesuai asal hasil.
- Kutipan klaim, ticker, jenis klaim, dan jumlah klaim berasal dari hasil pemeriksaan, bukan teks dekoratif.

| Status aktual | Makna yang harus tetap jelas |
|---|---|
| “Didukung” | Angka cocok dalam toleransi dengan bukti yang tersedia |
| “Dibantah” | Nilai pembanding berada di luar toleransi |
| “Benar tapi menyesatkan” | Angka cocok, tetapi konteks kuat mengubah interpretasinya |
| “Tidak bisa diverifikasi” | Bukti numerik/data/periode belum cukup |
| “Di luar cakupan” | Prediksi atau opini |

- Status menggunakan teks dan indikator visual; warna saja tidak cukup.
- Pembanding: “Diklaim”, “Hasil pembanding”. Jangan menyamakan satuan atau definisi yang berbeda.
- Konteks: ringkasan aktual dari hasil hipotesis, “Mengapa penting?”, “Bukti konteks”.
- Penjelasan utuh: “Baca penjelasan lengkap”. Pertahankan penjelasan yang telah lolos grounding; tidak membuat angka atau alasan baru demi layout.
- Nilai rinci: “Nilai sebelum pembulatan”, “Klaim”, “Data”.
- Sumber: “Lihat sumber”. Detail proses: “Jejak pemeriksaan”.
- Tanpa klaim: “Belum ada klaim yang bisa diperiksa.”; “Sertakan pernyataan saham, angka, atau periode. Judul, daftar ticker, dan pertanyaan saja belum cukup.”
- Kegagalan ekstraksi: “Klaim belum diperiksa; tidak ada kesimpulan tentang isi konten.”

## Sumber dan visualisasi bukti

- Judul: “Sumber pemeriksaan”. Kontrol: “Tutup sumber”, “Grafik”, “Semua sumber”, “Pilih grafik”. Status rapor tetap terlihat saat menelusuri bukti.
- Visualisasi aktual mencakup “Perbandingan yield” dan “Klaim vs data” jika angka sebanding tersedia.
- Interaksi: “Pilih angka untuk membuka buktinya”, “Bukti angka ini”. Setiap nilai terhubung dengan evidence yang mendasarinya.
- Definisi berbeda: “Definisi berbeda · bukan urutan waktu”. Tidak membuat grafik tren dari kumpulan metrik berlainan.
- Tanpa angka sebanding: “Belum ada angka yang sebanding”; “Bukti teks tersedia di semua sumber.”
- Detail: “Nilai lengkap”, “Diambil”, “Asal”, “Rumus”, “Periode”, “Saham”, “Mulai”, “Sampai”, “Tahun”, “Rentang”; hanya tampilkan field yang tersedia.
- Label data contoh: “Contoh historis · bukan data terkini”; “Fixture contoh, bukan data pasar terkini”.
- Provider hanya pada atribusi sumber: “Sectors · data tersimpan”, “Sectors API”, “Dokumentasi sumber Sectors”. Tautan nyata: https://docs.sectors.app.
- Pencarian: “Cari sumber”; placeholder “Cari metrik atau saham”. Hasil kosong: “Tidak ada sumber yang cocok. Coba kata lain.”
- Penjelasan grafik aktual: “Nilai dibulatkan untuk tampilan. Setiap batang memakai satuan yang sama. Yield dari definisi berbeda bukan riwayat tahunan; nilai lengkap dan asal data tersedia di semua sumber.”

### Contoh dan asal data

| Contoh | Asal dan batas |
|---|---|
| ADRO yield 25,5% setahun | Fixture kontrak historis dari AGENTS.md bagian 6, verifikasi 23 Sep 2026; bukan respons API terkini. Status fixture: misleading |
| BBCA PER cuma 3x | Angka sintetis pada fixture pengujian; bukan kutipan PER pasar terkini. Status fixture: supported |
| BBRI bakal naik 80% | Contoh prediksi, bukan fakta kenaikan atau rekomendasi. Status fixture: out_of_scope |

Angka ADRO yang tersedia dalam fixture: rata-rata tercatat 25,5%; ringkasan rata-rata mandiri sekitar 23,6% untuk 2021–2025; pembayaran khusus Rp1.358,18 pada 28 November 2024 terkait pemisahan AADI; yield pembayaran khusus 45,2%; yield TTM 5,56%; rasio pembayaran kas −0,897×. Ringkasan 23,6% tidak dihitung ulang dari deret tahunan di fixture. Jangan membuat deret tahunan dari angka ringkasan ini. Data dividen 2026 belum tersedia menurut catatan proyek tersebut; ketiadaan data tidak membuktikan tidak ada pembayaran.

## Riwayat dan tersimpan

- Judul: “Riwayat pemeriksaan”, “Rapor tersimpan”; konsisten tingkat hierarki dengan “Periksa klaim saham”.
- Tindakan: “Cek klaim baru”, “Buka rapor”, “Simpan rapor”, “Hapus dari tersimpan”.
- Pencarian: “Cari isi klaim...”. Filter: “Status”, “Semua”, lima label status rapor.
- Baris menampilkan isi klaim, ticker, tanggal dan status aktual, serta keadaan tersimpan.
- Kosong: “Belum ada rapor tersimpan”, “Belum ada riwayat pemeriksaan”.
- Tanpa hasil pencarian: “Belum ada yang cocok.”; “Coba kata pencarian atau status lain.”; “Reset pencarian”.
- Tindakan kosong: “Mulai cek klaim”.
- Privasi aktual: “Riwayat disimpan di browser ini, maksimal 50 rapor terbaru.” Penyimpanan server tampil sesuai ketersediaan, bukan diasumsikan aktif.

## Panduan dan Tentang

Panduan: “Cara pemeriksaan bekerja”; “Kenali tahapan pemeriksaan dan arti setiap status pada rapor.”

- “Ekstraksi klaim”: “Teks diurai menjadi pernyataan yang bisa diperiksa. “PER 3x” adalah klaim angka. “Pasti cuan” adalah prediksi.”
- “Perbandingan data”: “Data saham menjadi pembanding. Angka diperiksa melalui perhitungan, dengan periode yang sesuai.”
- “Pemeriksaan konteks”: “Context Hunter menelusuri kemungkinan pembayaran satu kali, basis pembanding rendah, atau periode yang dipilih-pilih.”
- “Hasil dan sumber”: “Rapor menunjukkan status, data pembanding, dan konteksnya. Jika data tidak cukup, hasil menyatakannya secara terbuka.”

Tentang adalah halaman `/about`, dengan satu tautan navigasi “Tentang Cek Dulu”.

- Intro: “Pemeriksaan klaim saham Indonesia dari postingan, screenshot, dan video.”
- “Apa yang diperiksa?”: “Angka dalam klaim, periode pembanding, dan konteks yang mengubah maknanya.”
- “Isi konten”: “Dipecah menjadi klaim terpisah”.
- “Angka & konteks”: “Dibandingkan dengan data yang tersedia”.
- “Rapor klaim”: “Status, pembanding, dan sumber”.
- “Peran AI”: “Membaca konten dan menulis penjelasan. Perhitungan angka dan status ditentukan oleh aturan program.”
- “Asal data”: “Data saham bersumber dari Sectors. Periode dan waktu pengambilan tersedia di setiap bukti.”
- “Batas pemeriksaan”: “Prediksi dan opini berada di luar cakupan. Data kosong tidak cukup untuk mendukung atau membantah klaim.”
- FAQ “Hal yang perlu diketahui”: “Angka benar, mengapa bisa menyesatkan?”, “Apakah data selalu terbaru?”, “Bagaimana dengan screenshot dan video?”, “Apa yang tersimpan di riwayat?”. Jawaban lengkap yang sudah ada tetap tersedia dari `apps/web/components/about-content.tsx`; fase ini tidak mengubah copy tersebut.
- Tindakan: “Pelajari arti setiap status”, “Dokumentasi sumber”, “Periksa klaim”. “Informasi versi” memakai revisi build aktual.

## Footer — wajib permanen

> Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi. Status klaim menilai kesesuaian klaim dengan data yang tersedia, bukan kelayakan membeli atau menjual saham. Data bersumber dari Sectors dan dapat tertinggal dari kondisi terkini. Lakukan riset sendiri sebelum mengambil keputusan.

Logo, tahun hak cipta aktual, “Sumber data saham”, dan tautan “Sectors” adalah konten footer yang sudah ada. Tidak menambahkan tautan legal kosong, testimoni, logo klien, jumlah pengguna, atau statistik keberhasilan yang belum terbukti.

## Aset dan batas editorial

- Pertahankan logo Cek Dulu yang sudah ada. Ikon yang tersedia menggunakan Lucide; jangan memasang pustaka baru pada fase inventaris.
- Font implementasi sekarang Source Sans 3 lokal. Pemilihan font berikutnya belum diputuskan; panduan baru membatasi dua keluarga font, teks minimal 14 px, isi utama minimal 16 px.
- Tidak ada foto tim, testimoni, lisensi aset baru, atau persetujuan penggunaan logo pihak lain dalam materi fase ini. [KONFIRMASI] Aset baru harus diperiksa asal dan lisensinya saat dipilih.
- Tidak menggunakan slogan panjang atau klaim kemampuan tanpa verifikasi sebagai pengisi ruang.
- Persingkat tampilan melalui hierarki dan pengungkapan bertahap; semua peringatan relevan harus tetap dapat ditemukan sebelum pengguna melanjutkan.
- Penampilan angka tidak mengubah nilai asli, rumus, verdict, atau provenance. Tidak membuat animasi angka yang memberi kesan data berubah.
- Admin, autentikasi baru, perluasan kemampuan video, dan data live bukan tambahan scope desain otomatis.

## Pemeriksaan cakupan dan dokumen berikutnya

- [x] Brief, pengguna, platform, tugas utama, dan batas proyek tercatat.
- [x] Semua layar utama serta keadaan kosong, sibuk, ambigu, error, dan berhasil diinventarisasi.
- [x] Konten nyata dipisahkan dari contoh historis/sintetis dan usulan.
- [x] Alur media memuat peninjauan transkripsi sebelum pemeriksaan.
- [x] Kesimpulan, perbandingan, konteks, sumber, privasi, dan disclaimer tetap tercakup.
- [x] Pengguna menyetujui kelanjutan dari Fase 1 melalui pesan “lanjut”.
- [ ] Fase 2: riset referensi nyata dan pemilihan, lalu `REFERENSI.md`.
- [ ] Fase 3: token visual, lalu spesifikasi desain yang disetujui.
- [ ] Fase 4 dan berikutnya: alternatif layout, mockup, evaluasi, kemudian implementasi.

`design.md` milik pengguna sudah ada dan tidak ditimpa. Pada Windows, `DESIGN.md` dan `design.md` menunjuk nama file yang sama. Arahan lama tentang glass/glow dan tiga keluarga font perlu diganti melalui persetujuan fase desain, bukan diterapkan otomatis. `docs/ui-design.md` menjadi catatan implementasi terdahulu, bukan persetujuan desain baru.

Sumber inventaris: AGENTS.md proyek; `apps/web/components/workspace.tsx`, `input-adapter.tsx`, `check-report.tsx`, `about-content.tsx`, `site-footer.tsx`; `apps/web/lib/check-view.ts`; `packages/shared/fixtures/index.ts`; serta panduan yang diberikan pengguna di direktori Kakas.

## Landing yang disetujui

Beranda `/` memakai judul “Klaim saham. Lihat buktinya.”, satu kalimat pengantar, satu CTA Periksa klaim ke `/check`, contoh historis ADRO berlapis dengan panah samping, akses Tentang dan footer disclaimer lengkap. Daftar format input, CTA duplikat serta kontrol berteks di bawah kartu tidak ditampilkan. Pemeriksaan, riwayat, rapor tersimpan dan panduan tersedia pada `/check`.
