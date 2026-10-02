# Mockup arah desain Cek Dulu

Tiga layar desktop 1440 × 900 memakai kondisi awal yang sama: input teks kosong. Ini artefak review desain, bukan perubahan aplikasi atau pemeriksaan saham baru.

Revisi warna tersedia di http://127.0.0.1:3012/?palette=all dengan teks contoh terisi untuk memperlihatkan tombol aktif. Lihat [catatan palet](../design-palettes.md). Review ini memakai satu layout yang sama dan tidak mengubah pilihan layout final.

Palet terpilih adalah slate–biru. Empat mockup mobile tersedia di http://127.0.0.1:3012/?mobile=all; [catatan review mobile](../design-mobile-review.md) menjelaskan alur, pemeriksaan lebar 360/390 px, dan batas prototype.

## Melihat hasil

Jalankan `node docs/design-mockups/serve.cjs` dari root repo, lalu buka http://127.0.0.1:3012/?view=all. Server hanya menerima koneksi lokal dan melayani berkas mockup yang diizinkan. Tautan atas berpindah antara perbandingan dan layar ukuran penuh; tombol input/pemeriksaan tidak menjalankan pipeline.

- [Arah 1: form bertahap](exports/direction-1.png)
- [Arah 2: pemeriksaan berdampingan](exports/direction-2.png)
- [Arah 3: lapisan bukti spasial](exports/direction-3.png)
- [Perbandingan](exports/comparison.png)

Pen.dev mengarah ke dokumen proyek lain meskipun lokasi dokumen baru diberikan. Dokumen tersebut hanya dibaca, tidak diubah. Mockup menggunakan jalur cadangan HTML terpisah; tidak ada berkas .pen baru yang berhasil dibuat.

## Konten dan aset

Logo mengikuti logo Cek Dulu yang sudah ada. Source Sans 3 disalin dari aset proyek; Barlow Semi Condensed diambil dari repositori resmi Google Fonts. Lisensi OFL disertakan untuk keduanya. Ikon menggunakan bentuk Lucide dengan lisensi yang disertakan.

Preview ADRO memakai fixture kontrak, dengan label “Contoh historis” dan peringatan bahwa angka bukan data pasar terkini. Nilai klaim dan pembanding 25,5% digambar pada skala bersama 0–30%, bukan lebar dekoratif. Pembayaran Rp1.358,18 dan konteks pemisahan AADI mengikuti fixture. Label enam bukti mengikuti jumlah evidence fixture. Tidak ada pengambilan data live, angka kredit palsu, atau pemanggilan LLM.

## Kritik dan pemeriksaan

Arah 1 paling fokus tetapi dapat terasa kosong. Arah 2 paling seimbang: input mudah ditemukan, hasil terbaca melalui verdict, perbandingan angka, dan satu catatan konteks. Arah 3 memiliki karakter paling kuat tetapi menambah risiko keterbacaan serta kompleksitas interaksi. Rekomendasi masih arah 2; keputusan pengguna belum dicatat.

Perbaikan selama review: jarak panel terhadap footer dirapikan, skala grafik ditampilkan, label belakang yang tertutup dihapus, dan batas kontrol penting diperjelas. Isi kartu tetap solid tanpa glassmorphism.

Pemeriksaan browser: ketiga artboard berukuran 1440 × 900 tanpa overflow pada ukuran tersebut; font utama berhasil dimuat; ukuran teks minimum 14 px pada skala asli. Pasangan warna solid teks utama/permukaan memiliki rasio kontras 12,03:1 dan teks sekunder/permukaan 7,01:1. Ini pemeriksaan visual terbatas, bukan sertifikasi aksesibilitas seluruh aplikasi.

Validasi repo: `pnpm test` lulus, 775 test dalam 27 berkas; `pnpm -r typecheck` lulus. Sintaks server dan JavaScript mockup juga diperiksa. Test repo memverifikasi kode aplikasi yang sudah ada, bukan fungsionalitas tombol mockup.

Adaptasi mobile, animasi, navigasi keyboard, interaksi sumber, dan integrasi API belum direalisasikan di mockup ini. Tahap berikutnya: pengguna memilih arah, lalu membuat adaptasi mobile dan detail layar untuk disetujui sebelum implementasi produk.
