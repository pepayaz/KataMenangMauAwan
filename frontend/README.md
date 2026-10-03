# Cek Dulu — Frontend Only

Frontend mandiri untuk prototipe **Cek Dulu**, dibuat dengan React + TypeScript + Vite.

Folder ini sengaja **tidak terhubung ke backend, Sectors API, Supabase, SSE, atau LLM**. Semua interaksi memakai fixture lokal untuk memperagakan UI dan motion saja.

## Fokus desain

- Desktop only untuk iterasi ini (`min-width: 1180px`).
- Landing page cinematic-editorial dengan verification machine, translucent data plates, dan product window.
- Workspace gelap bergaya financial intelligence yang lebih tactile dan less-template.
- Input chamber dengan **4 mode sumber**: Teks, Screenshot, Link video, dan Unggah video.
- Live investigation trace, Context Hunter state, verdict report, evidence inspector, history, dan saved reports.
- Palette mengikuti `design.md`: dark navy, cyan, blue, lime, amber, red, violet.
- Font: Bricolage Grotesque untuk display, Instrument Sans untuk UI/body, IBM Plex Mono untuk technical/data labels.
- Surface memakai subtle grain, liquid-glass depth, mixed corner radii, dan button tactile agar tidak terasa seperti UI generator AI generik.
- Motion halus dan fungsional; `prefers-reduced-motion` didukung.

## Jalankan

```bash
npm install
npm run dev
```

Build production:

```bash
npm run build
npm run preview
```

## Alur demo frontend

1. Landing page → pilih contoh atau buka workspace.
2. Pilih sumber input: **Teks / Screenshot / Link video / Unggah video**.
3. Untuk screenshot dan video, UI menjalankan simulasi pembacaan lokal lalu menampilkan teks hasil pembacaan yang bisa diedit. Tidak ada OCR/video API sungguhan pada paket frontend-only ini.
4. Klik **Periksa klaim**.
5. UI menampilkan simulasi **Live Investigation** bertahap.
6. Fixture yang dikenal menampilkan report lengkap; teks lain berakhir sebagai state **Tidak bisa diverifikasi**.
7. Report dapat disimpan ke localStorage dan dibuka kembali dari **Riwayat** / **Tersimpan**.

Fixture yang disediakan:

- ADRO — dividen — `Benar, tapi menyesatkan`
- BBCA — valuasi — `Dibantah`
- TLKM — price move — `Didukung`

Data di fixture hanya untuk presentasi frontend dan tidak boleh dianggap sebagai data pasar terkini.

## Struktur

```text
frontend/
├─ public/
│  └─ favicon.svg
├─ src/
│  ├─ App.tsx       # seluruh surface UI dan state demo frontend
│  ├─ demo.ts       # static fixtures + local history type
│  ├─ main.tsx
│  ├─ styles.css    # layout, surfaces, animation, desktop composition
│  └─ theme.css     # design tokens + font setup
├─ index.html
├─ package.json
├─ package-lock.json
├─ tsconfig.json
└─ vite.config.ts
```

Tidak ada `.env` atau API key yang dibutuhkan.
