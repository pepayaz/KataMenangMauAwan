# Screenshot, caption video dan Web Share Target

## Screenshot

Di UI pilih Screenshot, unggah satu PNG/JPEG/WebP maksimal 3 MB, lalu tekan
Baca teks screenshot. POST /api/input memvalidasi ukuran stream dan signature
file sebelum mengirim data URL ke adapter LLM yang sama. LLM_MODEL harus
mendukung vision dan structured output. Semua output OCR divalidasi Zod;
invalid -> retry sekali -> error terkontrol. Model/provider/key dari env.

Teks dibaca sebagai data, angka/satuan disalin tanpa hitungan, metadata kreator
serta UI sosial diabaikan melalui prompt. Hasil yang kabur diberi peringatan.
Pengguna mengoreksi teks/angka, lalu memulai cek. Screenshot tidak disimpan pada
server atau riwayat; teks koreksi disimpan sebagai CheckInput source screenshot.
Gambar dikirim ke provider LLM; OCR memakai biaya LLM, bukan kredit Sectors.
Tidak ada caption/transkrip buatan jika OCR gagal: gunakan teks manual.

## Link video

Pilih Link video, masukkan URL HTTPS lalu Ambil caption. TikTok memakai
https://www.tiktok.com/oembed?url=... sesuai dokumentasi resmi:
https://developers.tiktok.com/docs/en/embed-videos . Hanya title/caption dipakai;
author_name, html, thumbnail dan video tidak diambil/dieksekusi/disimpan.
Request memiliki timeout 10 detik, batas respons 64 KiB dan redirect ditolak.
Host TikTok eksplisit saja; input URL tidak pernah menjadi alamat fetch server.
Link pendek diteruskan ke oEmbed; jika layanan tidak menerima link tersebut,
pengguna diminta memakai URL lengkap atau teks/screenshot.

Caption ditampilkan untuk koreksi. CheckInput tetap memakai source paste dengan
url sumber (enum source lama tidak diubah). Ucapan/tulisan di dalam video tidak
ditranskripsikan. Caption kosong/tidak tersedia atau platform lain memberi
needs_text; URL tetap tampil dan teks manual/screenshot dapat dipakai.

## Web Share Target dan PWA

Manifest dinamis /manifest.webmanifest dan service worker tersedia. Worker
hanya mendukung instalasi; tidak menyimpan input, API, rapor atau menjanjikan
mode offline. Manifest hanya memasang share_target jika flag share_target aktif.

Untuk pengujian Chrome Android dengan origin HTTPS dan PWA terpasang, set
FLAG_SHARE_TARGET=1 di apps/web/.env.local lalu restart server. Di Supabase,
flag share_target juga dapat diaktifkan pada feature_flags. Default tetap mati. Manifest menerima image/*; server tetap memvalidasi
PNG/JPEG/WebP maksimal 3 MB dan menolak format lain dengan pesan yang jelas.
Instal Cek Dulu melalui menu Chrome, lalu bagikan gambar/teks/link ke aplikasi.
Penerima POST /share memakai multipart/form-data. Gambar melewati OCR; teks
langsung dipertahankan; URL tunggal memakai oEmbed. Semua menunggu peninjauan
pengguna di halaman utama. Payload teks dipindahkan via sessionStorage per tab,
dihapus setelah dibaca; tidak dikirim lewat query URL. HTML handoff memakai
escaping dan CSP nonce. Saat flag mati, POST ditolak dan manifest tidak
menampilkan share target. iOS tetap menggunakan salin-tempel/upload.

## Kontrak dan perubahan B/C

Shared menambah InputAdaptationSchema beserta fixture: ready/needs_text, rawText,
source, url opsional dan warnings. Claim, Evidence, TraceEvent tidak berubah.
Input adapter berjalan sebelum cek: ia belum punya checkId, bukan trace verifikasi;
trace SSE baru dimulai saat pengguna mengirim teks yang telah ditinjau.

C: workspace menambah kontrol input/preview/peringatan, meneruskan source/url,
menyimpan metadata sumber pada riwayat lokal, menambahkan manifest/registrasi PWA.
B: detail riwayat meneruskan source/url agar membuka rapor mempertahankan
sumber screenshot/link; route baru /api/input serta adapter oEmbed/upload; /api/check tetap memakai
kontrak dan pipeline yang sama. LLM A diperluas dengan input_image menggunakan
Responses API: https://developers.openai.com/api/docs/guides/images-vision .
Semua akses data saham tetap melalui packages/sectors dan cache_only.

## Verifikasi

Test tanpa jaringan mencakup OCR mock -> input siap -> pipeline/SSE ADRO,
retry/invalid OCR, bytes/MIME/ukuran unggahan, caption valid/kosong/error,
URL tidak aman/platform lain tanpa fetch, tidak meneruskan kreator/HTML,
kontrak fixture, flag share target, handoff aman dan structured vision request.
OCR provider nyata memerlukan env/key yang belum tersedia pada mesin ini.
Berbagi dari Chrome Android terpasang belum diuji pada perangkat nyata;
feature flag tetap mati. Tidak ada scraping atau panggilan Sectors live.

Browser lokal memverifikasi pilihan gambar/pratinjau, error OCR tanpa konfigurasi,
dan link platform lain yang mempertahankan URL sambil meminta teks manual.
Unit test memakai mock OCR; tidak ada pengujian OCR provider nyata.

Hasil akhir: pnpm test 677 test / 24 file lulus, pnpm -r typecheck lulus,
dan build produksi Next.js lulus termasuk /api/input, /share dan manifest.
