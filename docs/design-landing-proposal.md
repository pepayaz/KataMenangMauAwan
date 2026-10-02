# Usulan landing Cek Dulu

Status: preview interaktif untuk persetujuan; belum mengganti halaman utama.

## Arah yang disarankan

Palet slate–blue yang sudah disetujui, logo lama dipertahankan, kartu solid dengan border netral. Hero berisi judul “Klaim saham. Lihat buktinya.”, satu kalimat penjelasan, tombol Periksa klaim, dan jenis input yang tersedia. Tidak menambahkan statistik, testimoni, atau klaim keberhasilan rekaan.

Visual utama berupa tiga lembar bukti dalam ruang 3D: Klaim, Data, Konteks. Pointer memberi kemiringan ringan, lembar bergerak perlahan, tombol tahap membawa lembar terkait ke depan. Contoh ADRO historis ditandai sebagai contoh, bukan hasil pemeriksaan baru. Angka 25,5% dan TTM 5,56% dari AGENTS.md bagian 6, dengan penjelasan bahwa periodenya berbeda; grafik contoh ini bukan kalkulasi verdict.

Bagian akhir menyediakan shortcut kedua ke pemeriksaan, atribusi sumber dan disclaimer lengkap. Tidak membuat grid fitur atau paragraf pemasaran panjang.

## Routing saat diterapkan

- `/`: landing baru.
- `/check`: pemeriksaan saat ini, termasuk query view riwayat/tersimpan/panduan.
- `/about`: tetap halaman tentang.
- Tautan lama `/?view=history|saved|guide` perlu diarahkan ke tampilan setara pada `/check`, bukan kehilangan riwayat.
- Audit tautan logo, footer, share target, halaman detail dan manifest sebelum memindahkan checker. Tidak mengubah pipeline atau penyimpanan riwayat.

Preview HTML sengaja memakai shortcut localhost:3001 yang masih menuju checker saat ini. Preview bukan route produk final.

## Gerak, aksesibilitas, performa

CSS perspective dan transform untuk prototipe ini; tidak memakai model WebGL atau embed pihak ketiga. Gerak bisa dihentikan, preferensi reduced-motion dihormati, kontrol bisa dipakai lewat keyboard, pointer tilt dinonaktifkan pada perangkat touch. Di mobile visual disusun di bawah CTA. Versi produk perlu menghentikan gerak saat hero tidak terlihat atau tab tidak aktif.

Jika CSS 3D ini disetujui tetapi hasil visual memerlukan geometri lebih nyata, evaluasi satu scene lokal ringan sebagai peningkatan terpisah; jangan mengunduh model besar sebagai background default. Tidak memakai glassmorphism.

## Referensi yang dibuka

- [Codrops: 3D Stack Motion](https://tympanus.net/Development/3DStackMotion/): referensi gerak dan kedalaman lembar; tidak mengambil copy pemasaran atau asetnya.
- [Spline: optimasi scene](https://docs.spline.design/exporting-your-scene/how-to-optimize-your-scene): objek, material dan efek yang sederhana untuk mempertahankan performa bila WebGL diperlukan.

## Pengecekan sebelum integrasi

Tinjau preview desktop/mobile dan kontrol tahap. Setelah arah disetujui, integrasikan route dan komponen React, audit deep link/share target, jalankan test/typecheck/build, lalu verifikasi alur ADRO dari landing sampai sumber hasil.
