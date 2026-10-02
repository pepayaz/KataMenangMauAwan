# Cek Dulu — Frontend Design Spec

## 1. Design Direction

**Aesthetic:** `financial intelligence terminal × futuristic cyberpunk product UI`.

Referensi visual utama:
- Dark, cinematic, high-contrast seperti dashboard Haulix/CY·FOCUS.
- Komposisi produk yang clean seperti OneText dan Assetario.
- Efek futuristik hadir lewat glow, garis/grid, depth, motion, dan visualisasi data — **bukan** lewat neon berlebihan.
- UI tetap terasa kredibel sebagai produk finansial, bukan game.

**Keywords:** precise, investigative, fast, intelligent, dark, luminous, trustworthy.

---

## 2. Visual System

### Color Palette

```css
--bg-0: #05070B;        /* page background */
--bg-1: #090D14;        /* main surface */
--bg-2: #0E1420;        /* elevated card */
--bg-3: #151D2A;        /* hover / active */

--line: #202B3A;
--line-bright: #30445C;

--text-1: #F4F7FB;
--text-2: #AAB6C5;
--text-3: #6E7C8F;

--cyan: #37D7FF;        /* primary futuristic accent */
--blue: #5B78FF;
--lime: #B8FF5C;        /* success / active agent state */
--amber: #FFB547;       /* misleading / caution */
--red: #FF5F6D;         /* refuted / error */
--violet: #A98BFF;      /* unverifiable */
```

### Gradient

Gunakan gradient hanya sebagai aksen:

```css
linear-gradient(135deg, #37D7FF 0%, #5B78FF 55%, #A98BFF 100%)
```

Untuk glow, opacity maksimal sekitar `20–30%`. Hindari seluruh card menjadi neon.

### Background Treatment

- Background hampir hitam dengan **radial glow** biru/cyan yang sangat lembut.
- Tambahkan grid tipis 48–64px pada area hero/dashboard.
- Noise/grain sangat halus agar visual tidak terasa flat.
- Glow mengikuti area interaktif penting, bukan seluruh layar.

---

## 3. Typography

Gunakan 3 role font agar tetap unik tetapi readable.

### Display / Heading — `Oxanium`
- Hero heading
- Section title
- Angka besar / verdict utama
- Weight: 500–700

Memberi karakter futuristic tanpa terlalu sci-fi.

### UI / Body — `Manrope`
- Body copy
- Navigation
- Form labels
- Buttons
- Weight: 400–600

### Data / Technical — `IBM Plex Mono`
- Ticker saham
- Persentase / angka pembanding
- Timestamp
- Trace event
- Evidence metadata

**Rule:** jangan pakai mono untuk paragraf panjang.

---

## 4. Shape & Component Language

- Card radius: `16px`
- Large container / modal: `20–24px`
- Button radius: `10–12px`
- Border: `1px solid var(--line)`
- Shadow: gelap, lembut; glow hanya untuk state aktif.
- Surface memakai dark glass ringan (`backdrop-blur`) hanya jika ada background visual di belakangnya.

Gunakan sudut geometris, divider tipis, label uppercase kecil, dan sedikit technical microcopy supaya terasa seperti analysis console.

---

## 5. Landing Page

Landing page dibuat **singkat**. Tidak perlu pricing, testimonial, blog preview, stats palsu, atau section marketing yang panjang.

### Navbar

Kiri: logo **Cek Dulu**  
Kanan: `Cara Kerja` · `Riwayat` · tombol `Masuk`

Navbar transparan di atas hero, berubah menjadi dark glass saat scroll.

### Hero

Layout desktop `55 / 45`.

**Kiri**
- Eyebrow: `AI CLAIM VERIFICATION`
- Heading:
  **Jangan cuma percaya. Cek dulu.**
- Supporting text maksimal 2 baris: jelaskan bahwa pengguna bisa menempelkan klaim saham dan membandingkannya dengan data resmi serta konteks yang hilang.
- Input utama berupa large paste box.
- CTA: `Periksa Klaim`
- Secondary microcopy: `Tempel teks dari X, TikTok, Telegram, atau sumber lain.`

**Kanan**
Bukan ilustrasi stock biasa. Buat **animated verification core**:
- 1 kartu posting/mock claim masuk.
- Garis scanner bergerak.
- Node `Ticker → Claim → Evidence → Context → Verdict` aktif satu per satu.
- Small floating data tags seperti `$ADRO`, `Yield 25%`, `Evidence found`.
- Depth/parallax sangat halus saat cursor bergerak.

Tujuannya memberi kesan bahwa sistem benar-benar “membongkar” klaim.

### Cara Kerja

Hanya 3 langkah:
1. **Tempel klaim**
2. **Agen memeriksa evidence & konteks**
3. **Dapatkan verdict + sumber**

Gunakan horizontal connected nodes di desktop, stacked timeline di mobile.

### Product Preview

Tampilkan satu mock report besar sebagai bukti UI nyata, bukan section marketing tambahan.

Isi preview:
- claim
- verdict
- claimed vs verified value
- missing context
- evidence
- trace mini-panel

### Final CTA

Simple centered CTA:
**Ada klaim saham yang bikin ragu?**  
`Cek sekarang`

### Footer

Minimal: logo, disclaimer, sumber data, dan link legal bila ada.

---

## 6. Application Shell

### Desktop

```text
┌ Sidebar ─────┬──────────────────────────────────────────┐
│ Cek Dulu     │ Header / current check                  │
│              ├──────────────────────────────────────────┤
│ + Cek Baru   │ Main workspace                          │
│ Riwayat      │                                          │
│              │                                          │
│ Account      │                                          │
└──────────────┴──────────────────────────────────────────┘
```

Sidebar sekitar `220–240px`, dark solid, icon + text.

### Mobile / PWA

- Header ringkas dengan logo.
- Primary content full-width.
- Bottom navigation hanya jika akun/riwayat aktif: `Cek` dan `Riwayat`.
- CTA utama tetap mudah dijangkau dengan satu tangan.

---

## 7. Check Flow

### A. Idle / Input

Main card:
- textarea besar
- optional source URL
- character count kecil
- CTA `Periksa Klaim`

Tambahkan 2–3 example chips saja, misalnya:
- `PER cuma 3x, murah banget`
- `Yield dividennya 25%`
- `Sebulan naik 80%`

Klik chip mengisi textarea, bukan langsung submit.

### B. Analyzing State

Jangan gunakan spinner besar di tengah layar.

Tampilkan **live trace panel** seperti activity console:

```text
● Mengenali ticker          ADRO
● Memecah klaim             2 klaim ditemukan
● Mengambil data            Dividend / Company Report
◌ Menguji konteks           One-off dividend...
○ Menentukan verdict
```

State:
- complete = check icon
- active = pulsing cyan/lime dot
- pending = muted dot
- error = red icon

Credit / technical metadata boleh muncul kecil di mode detail, bukan sebagai fokus utama.

### C. Ticker Ambiguous

Modal kecil, langsung ke inti:

**Kami menemukan beberapa ticker yang mungkin dimaksud.**

Tampilkan maksimal beberapa candidate card dengan ticker + nama perusahaan. User memilih satu lalu proses lanjut.

### D. Result

Result page harus terasa seperti **investigation report**, bukan chatbot response.

Urutan:
1. Header check + detected ticker
2. Summary verdict
3. Claim cards
4. Agent trace collapsible
5. Sources/evidence

---

## 8. Claim Report Card

Setiap klaim memiliki card sendiri.

```text
[DIVIDEND]                         [BENAR, TAPI MENYESATKAN]

"Yield dividennya 25% setahun"

Diklaim                  Data terbaru
25.0%                     5.6%

KONTEKS YANG HILANG
Satu pembayaran dividen luar biasa membuat rata-rata historis terlihat jauh lebih tinggi.

Evidence  3 sumber  →
```

### Verdict Treatment

Status **tidak boleh hanya dibedakan lewat warna**. Selalu gabungkan color + icon + label.

| Verdict | Accent | Icon style |
|---|---|---|
| Didukung | Lime | check-circle |
| Dibantah | Red | x-circle |
| Benar tapi menyesatkan | Amber | warning / split-circle |
| Tidak bisa diverifikasi | Violet | question-circle |
| Di luar cakupan | Gray | minus-circle |

`Benar tapi menyesatkan` dibuat sedikit lebih prominent karena merupakan diferensiasi utama produk.

### Evidence Drawer

Saat user klik `Lihat evidence`:
- label evidence
- value + unit
- source/tool
- fetched time
- source link bila tersedia

Jangan dump JSON mentah di UI utama.

---

## 9. History

Gunakan list/card sederhana.

Setiap row:
- tanggal
- ticker
- potongan klaim
- verdict
- badge `STATUS BERUBAH` bila verdict berbeda dari pemeriksaan sebelumnya

Filter cukup `Semua` / ticker search. Jangan tambah sorting/filter kompleks jika belum dibutuhkan.

---

## 10. Motion System

Motion harus terasa seperti sistem sedang memproses data.

### Hero
- floating card: 5–8s slow drift
- scanner sweep: 2–3s
- node illumination stagger: 120–180ms
- subtle pointer parallax: max 6–10px

### App
- page/card entrance: opacity + `translateY(8px)`, 180–240ms
- trace event: slide/fade in, 160–220ms
- verdict reveal: border glow + count-up ringan pada angka, maksimal 500ms
- hover: border brighten + `translateY(-1px)`

### Rules
- Tidak ada constant aggressive pulsing.
- Tidak ada glitch effect pada teks utama.
- Tidak ada 3D transform berlebihan pada report/data cards.
- Support `prefers-reduced-motion`.

---

## 11. Responsive Rules

### Desktop `>= 1200px`
- Hero split layout.
- Report dapat memakai 2 kolom: claim report + trace/evidence.

### Tablet `768–1199px`
- Hero masih 2 kolom jika cukup, otherwise stack.
- Sidebar collapsible.

### Mobile `< 768px`
- Semua section single column.
- Hero visualization menjadi compact card stack.
- Metric comparison tetap side-by-side jika muat; jika tidak, vertical.
- Trace panel full-width.
- Modal berubah menjadi bottom sheet.

Target utama: Chrome desktop + Chrome Android/PWA.

---

## 12. UI Content Rules

- Bahasa utama: **Bahasa Indonesia**.
- Kalimat pendek dan langsung.
- Gunakan istilah teknis hanya jika membantu evidence.
- Produk **tidak** memberi rekomendasi beli/jual atau prediksi harga.
- Fokus pemeriksaan adalah **klaim**, bukan pembuat konten.
- Jangan menampilkan nama/foto pembuat konten sebagai elemen utama.

Disclaimer permanen di footer/app:

> Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi. Status klaim menilai kesesuaian klaim dengan data yang tersedia, bukan kelayakan membeli atau menjual saham. Data bersumber dari Sectors dan dapat tertinggal dari kondisi terkini. Lakukan riset sendiri sebelum mengambil keputusan.

---

## 13. Do / Don't

### Do
- Dark UI dengan hierarchy yang jelas.
- Jadikan data dan verdict sebagai hero di dalam aplikasi.
- Pakai mono font untuk angka/ticker.
- Gunakan glow hanya untuk membantu focus/state.
- Pastikan skeleton, empty state, error state, dan loading trace terlihat polished.

### Don't
- Jangan memenuhi halaman dengan card kecil tanpa prioritas.
- Jangan pakai neon rainbow.
- Jangan menambah pricing, testimonial, leaderboard, social feed, atau fitur komunitas.
- Jangan menampilkan chart harga hanya untuk dekorasi.
- Jangan membuat UI seperti terminal hacker penuh kode.
- Jangan mengorbankan keterbacaan demi tema cyberpunk.

---

## 14. Suggested Frontend Implementation

- **Next.js + TypeScript**
- **Tailwind CSS** untuk token/layout
- **Framer Motion** untuk interaction & reveal
- `next/font/google`: `Oxanium`, `Manrope`, `IBM_Plex_Mono`
- Icons: `lucide-react`

Buat reusable primitives minimal:
`Button`, `Input`, `Textarea`, `Badge`, `Panel`, `VerdictBadge`, `MetricCompare`, `TraceTimeline`, `EvidenceDrawer`, `ClaimCard`, `EmptyState`.

Prioritas implementasi UI:

`Check Input → Streaming Trace → Claim Report → Error/Ambiguous State → Mobile → History → Landing polish`
