# Review mobile — palet slate–biru

Palet kedua disetujui pengguna. Susunan desktop berdampingan dipakai sebagai dasar kerja untuk review, belum dicatat sebagai pilihan layout final. Kode aplikasi belum berubah.

Preview: http://127.0.0.1:3012/?mobile=all. Klik nama layar untuk membukanya sendiri. Empat layar: input kosong, peninjauan teks contoh, hasil historis ADRO, dan detail sumber. Tautan hasil/sumber/kembali serta disclosure dapat digunakan; tombol pemrosesan masih statis. Menu hanya contoh daftar navigasi.

## Keputusan UX

- Mobile memakai urutan vertikal, bukan memperkecil dua kolom desktop.
- Empat mode input memakai grid dua kolom dengan ikon dan nama tindakan.
- Input kosong tetap menonaktifkan pemeriksaan. Peninjauan media menampilkan Baca → Tinjau → Cek serta warning ticker/angka sebelum tindakan lanjut.
- Contoh loading/error tersedia melalui disclosure di layar peninjauan. Tidak ada persentase progres buatan atau klaim bahwa media sungguhan sudah dibaca.
- Verdict tetap di depan hasil dan sumber. Angka netral, batang klaim abu-abu, pembanding biru redup; konteks menjadi satu catatan pendek.
- Penjelasan panjang dibuka lewat disclosure. Detail sumber menampilkan grafik terlebih dahulu, kemudian definisi, hitungan mandiri, pembayaran khusus, dan asal nilai.
- Data diambil dari fixture ADRO: 25,5%, sekitar 23,6%, Rp1.358,18, 45,2%, tanggal pembayaran, TTM dan cash payout. Hitungan mandiri merupakan ringkasan fixture; tidak mengklaim dihitung ulang dari seri tahunan mentah.
- Footer disclaimer penuh tetap ada setelah konten dan dapat dicapai dengan menggulir. Tidak dipaksa masuk ke satu layar sehingga isi utama menjadi terlalu kecil.

## Pemeriksaan dan batas

Browser diuji pada lebar 390 dan 360 px. Input dan sumber tidak overflow horizontal. Artboard 390 × 844 memiliki scroll internal; ruang konten efektif berkurang karena scrollbar desktop, sebagaimana terlihat pada screenshot. Teks minimum 14 px, tombol/summary/tautan utama minimal 44 px; pilihan input 48 px.

Navigasi “Lihat sumber” membuka layar detail yang sesuai. Screenshot: [input](design-mockups/exports/mobile-input.png), [tinjau](design-mockups/exports/mobile-review.png), [hasil](design-mockups/exports/mobile-result.png), [sumber](design-mockups/exports/mobile-sources.png).

Kritik yang diperbaiki: judul Masukkan klaim berulang diganti menjadi judul layar Periksa klaim saham; angka grafik diturunkan ukurannya; penjelasan awal dipecah menjadi perbandingan dan catatan konteks; sumber tidak hanya daftar nilai. Grafik tidak mencampur rata-rata dan TTM sebagai periode yang sama.

Belum membuktikan keyboard/screen reader seluruh alur, unggah media, loading aktual, integrasi API, animasi produksi, atau usability pada perangkat fisik. Form transkripsi mockup readonly; implementasi wajib editable. CTA pembacaan sebelum transkripsi mengikuti design.md, bukan ditunjukkan sebagai pemeriksaan yang telah berjalan.

Langkah berikutnya: review pengguna atas susunan dan empat layar, lalu implementasi bagian input/hasil/sumber secara bertahap dengan kontrak aplikasi yang sudah ada.
