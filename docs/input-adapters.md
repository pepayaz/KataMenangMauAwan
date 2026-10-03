# Screenshot, isi video dan Web Share Target

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

Pilih Link video dan masukkan URL HTTPS video publik. Ekstraktor yt-dlp dari
`youtube-dl-exec` mengambil satu video (tanpa playlist, login, cookie atau DRM),
maksimal 8 MB dan 180 detik, dengan timeout unduhan 45 detik. Host sosial yang
diizinkan tercantum di `apps/web/lib/video-downloader.ts`; dukungan tiap situs
tergantung perubahan platform. URL internal dan kredensial dalam URL ditolak.
Video sementara dikirim ke Gemini sebagai inline video untuk membaca suara dan
teks di frame. Hanya teks hasil transkripsi yang diteruskan untuk koreksi pengguna;
video tidak disimpan. Model yang dikonfigurasi harus mendukung input video dan
structured output. Input video saat ini memakai `LLM_PROVIDER=gemini`.

Jika unduhan gagal, TikTok mencoba caption oEmbed resmi sebagai fallback.
Fallback diberi `status: needs_text` dan peringatan bahwa suara/frame **belum**
diperiksa. Platform lain meminta unggah video, screenshot, atau teks. Caption
tidak pernah diberi label seolah-olah seluruh video telah dibaca. CheckInput
tetap memakai source paste dan URL sumber; kontrak klaim/evidence tidak berubah.

## Unggah video

Pilih Unggah video untuk MP4 atau WebM maksimal 4 MB. Server memvalidasi ukuran,
MIME dan tanda tangan file sebelum mengirimnya ke Gemini. Ini membantu video
privat atau platform yang ekstraktornya gagal. Batas 4 MB berada di bawah batas
payload Vercel Function 4,5 MB; video yang lebih besar butuh unggah langsung ke
penyimpanan sementara berizin dengan penghapusan otomatis. Tanpa itu, gunakan
link publik, screenshot, atau teks manual. Unggahan video memakai source paste
karena CheckSource belum memiliki varian video; peringatan input menyebut asalnya.

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
langsung dipertahankan; URL tunggal menjalani pembacaan isi video dengan fallback
caption yang diberi label. Semua menunggu peninjauan
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
sumber screenshot/link; route /api/input menangani OCR, video publik dan upload; /api/check tetap memakai
kontrak dan pipeline yang sama. LLM A diperluas dengan input_image menggunakan
Responses API: https://developers.openai.com/api/docs/guides/images-vision .
Semua akses data saham tetap melalui packages/sectors dan cache_only.

## Verifikasi

Test tanpa jaringan mencakup OCR, validasi unggahan, host URL sosial, penolakan
URL internal, input video inline ke Gemini, fallback caption yang jelas, serta
handoff Web Share Target. Video TikTok publik yang diberikan pengguna berhasil
diunduh sebagai MP4 sekitar 2,2 MB dan ditranskripsikan oleh Gemini menjadi
judul serta ticker yang tampil di video; tidak ada panggilan Sectors live.
Berbagi dari Chrome Android terpasang dan deployment yt-dlp di Vercel masih
memerlukan smoke test pada lingkungan target. Video privat/DRM dan situs yang
mengubah proteksi dapat gagal; fallback unggah/screenshot/teks tetap tersedia.
