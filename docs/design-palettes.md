# Revisi palet — usulan untuk review

Status: pengguna memilih palet kedua, slate–biru, melalui pesan “saya pilih yang kedua, lanjut”. design.md sudah diperbarui sesuai pilihan. Layout berdampingan tetap kendaraan perbandingan warna, bukan pilihan layout final yang otomatis disahkan.

## Dasar keputusan

Palet awal memberi aksen cerah pada angka, grafik, logo, serta penanda aktif sekaligus, sedangkan tombol pada keadaan kosong tampak redup karena disabled. Revisi membandingkan keadaan dengan teks contoh terisi agar warna tombol aktif bisa dinilai dengan adil. Tombol tetap statis, tanpa menjalankan cek. Preview ADRO tetap berlabel historis.

Referensi yang dibuka:

- [Radix: penggunaan setiap tingkat warna](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale): bedakan latar, komponen, border, fill aksi, dan teks; jangan memakai warna teks terang sebagai fill seluruh komponen.
- [Radix: komposisi palet](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette): pilih keluarga netral yang sesuai dengan aksen. Nilai dasar Slate, Sand, Jade, Blue, dan Bronze diverifikasi pada [sumber resmi Radix](https://github.com/radix-ui/colors/blob/main/src/dark.ts).
- [Atlassian: peran warna](https://atlassian.design/foundations/color): warna dipilih berdasarkan fungsi dan tingkat penekanan, dengan peran aksi, netral, serta status yang berbeda.
- [Linear: pembaruan desain](https://linear.app/now/behind-the-latest-design-refresh): referensi hierarki antarmuka yang lebih tenang. Nilai hex mockup tidak diklaim berasal dari Linear.

Ini adaptasi dari sistem desain yang dipakai untuk antarmuka nyata, bukan bukti bahwa satu kombinasi pasti disukai atau meningkatkan konversi. Preferensi Cek Dulu masih perlu review pengguna.

## Alternatif

| Peran | 1. Grafit–jade | 2. Slate–biru | 3. Arang–bronze |
|---|---|---|---|
| Latar dasar | #111113 | #111113 | #111110 |
| Permukaan | #212225 | #212225 | #222221 |
| Teks utama | #EDEEF0 | #EDEEF0 | #EEEEEC |
| Teks sekunder | #B0B4BA | #B0B4BA | #B5B3AD |
| Aksi utama | #29A383 → #27B08B | #3B9EFF → #70B8FF | #A18072 → #AE8C7E |
| Batang pembanding | #409E88 | #698DB2 | #AD8E7F |

Ketiganya mempertahankan warna logo asli. Warna grafik merupakan penyesuaian lokal yang lebih redup, bukan salinan token Radix. Angka grafik berwarna netral dan berukuran 30 px, turun dari 40 px. Batang klaim abu-abu, batang pembanding diberi aksen redup; label eksplisit tetap membedakan maknanya. Status menyesatkan memakai amber dengan ikon dan label, tidak bergantung pada warna saja.

Latar memiliki gradien tonal terbatas di bagian atas; panel input memiliki perubahan tonal tipis dan bayangan untuk kedalaman. Bidang hasil tetap solid. Tidak ada blur, glassmorphism, atau gradien pada teks. Warna terkuat diarahkan ke tindakan utama; verdict mendapat bidang sendiri agar tetap mudah ditemukan.

Rekomendasi: grafit–jade karena menyambung dengan logo mint tanpa menambah aksen biru cerah pada semua angka. Slate–biru cocok bila tombol perlu terasa lebih tegas; arang–bronze memberikan alternatif hangat dengan risiko warna tombol lebih dekat ke warna status.

## Preview dan validasi

[Buka perbandingan lokal](http://127.0.0.1:3012/?palette=all). Gambar: [perbandingan](design-mockups/exports/palette-comparison.png), [jade](design-mockups/exports/palette-1.png), [biru](design-mockups/exports/palette-2.png), [bronze](design-mockups/exports/palette-3.png).

Pemeriksaan browser: semua artboard 1440 × 900 tanpa overflow tinggi, teks contoh identik, footer utuh. Rasio kontras dihitung untuk pasangan solid dan kedua ujung gradien tombol:

| Pemeriksaan | Jade | Biru | Bronze |
|---|---|---|---|
| Teks utama / permukaan | 13,70:1 | 13,70:1 | 13,71:1 |
| Teks sekunder / permukaan | 7,64:1 | 7,64:1 | 7,60:1 |
| Minimum teks tombol / ujung gradien | 5,88:1 | 6,57:1 | 5,23:1 |
| Batang pembanding / permukaan | 4,90:1 | 4,59:1 | 5,27:1 |

Ini pemeriksaan pasangan warna, bukan sertifikasi aksesibilitas keseluruhan. State hover, disabled, error, dan grafik banyak seri harus dilengkapi sesudah palet dipilih. Tidak ada perubahan kode produksi atau kontrak backend.
