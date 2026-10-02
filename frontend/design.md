# Cek Dulu — Frontend Design Direction v3

> Scope: **frontend desktop only**. No backend integration, no API calls, no Supabase, no SSE, no OCR/video processing service. Media input remains a UI/demo interaction only.

## 1. Direction

Target visual bukan lagi “cyberpunk dashboard dengan banyak glowing card”. Itu terlalu mudah terlihat seperti template AI.

Arah baru:

**editorial fintech + tactile dark surfaces + subtle futuristic instrumentation**

Referensi lama tetap dipakai untuk composition:
- OneText → cinematic hero dan layered product UI.
- Assetario → editorial composition, negative space, physical depth.
- Haulix / CY·FOCUS → dense data workspace.

Tetapi treatment UI mengikuti prinsip 2026:
- **Intentional Imperfection**: sedikit asymmetry, mixed corner radii, hand-drawn accent yang sangat minim.
- **Liquid Glass / Tactile Surface**: translucent dark material, refraction/highlight tipis, grain/noise, bukan glassmorphism blur berlebihan.
- **Expressive Typography**: typography jadi identitas utama, bukan gradient/glow.
- **Barely There UI**: beberapa section cukup separator dan spacing; jangan semua informasi dimasukkan card.
- **Spatial Composition**: kedalaman berasal dari layering, overlap, scale, dan positioning.
- **Kinetic Type / Motion**: movement kecil dan purposeful; hindari glitch dan perpetual neon pulse.

Keywords:

`human · editorial · investigative · tactile · precise · spatial · restrained`

## 2. Yang Harus Dihindari

Jangan:
- semua card radius 16–24px yang sama;
- gradient biru/ungu di setiap komponen;
- glow di setiap border/icon;
- semua label uppercase mono;
- button berbentuk pill;
- 3–4 feature card identik berjajar;
- card di dalam card di dalam card kalau separator cukup;
- heading techno seperti UI game;
- random sparkle icon / AI star sebagai dekorasi utama;
- neon cyan sebagai fill di banyak tempat.

Cyber/futuristic harus datang dari **material, depth, typography, instrumentation, dan motion**, bukan dari glow.

## 3. Palette

Palette lama tetap dipakai.

```css
--bg-0: #05070B;
--bg-1: #090D14;
--bg-2: #0E1420;
--bg-3: #151D2A;
--bg-soft: #101824;

--text-1: #F4F7FB;
--text-2: #AAB6C5;
--text-3: #6E7C8F;

--cyan: #37D7FF;
--blue: #5B78FF;
--lime: #B8FF5C;
--amber: #FFB547;
--red: #FF5F6D;
--violet: #A98BFF;
```

Accent color diperlakukan seperti tinta/cahaya kecil. 80–90% surface tetap dark neutral.

## 4. Typography

### Display — Bricolage Grotesque

Dipakai untuk:
- hero
- page title
- result headline
- large metric
- product showcase title
- brand wordmark

Karakter yang dicari: lebih editorial dan human daripada font techno.

```text
Hero             61–78px / 0.94 / 500–550
Page title        38–42px / 1.02 / 520–560
Section title     26–32px / 1.08 / 520–600
Large metric      36–54px / 0.98 / 550–620
```

Tracking headline: `-0.04em` sampai `-0.06em`.

### UI / body — Instrument Sans

Dipakai untuk seluruh navigation, paragraph, button, labels normal, form UI.

```text
Body              14–16px / 1.55
Navigation        11–13px / 1.2
Button            12–13px / 1.0
Supporting copy   12–14px / 1.5
```

### Technical — IBM Plex Mono

Hanya untuk data teknis:
- ticker
- timestamp
- evidence ID
- status machine
- tiny metadata

Jangan menjadikan seluruh UI uppercase mono.

## 5. Texture & Material

Tambahkan satu grain/noise layer global opacity sekitar `0.03`.

Glass surface:

```css
background:
  linear-gradient(112deg, rgba(255,255,255,.028), transparent 31%),
  rgba(11,17,26,.74);

border: 1px solid rgba(189,216,232,.13);
backdrop-filter: blur(20px) saturate(120%);

box-shadow:
  inset 0 1px 0 rgba(255,255,255,.05),
  0 22px 65px rgba(0,0,0,.28);
```

Hindari gradient surface yang terlalu “blue-purple AI”.

## 6. Geometry

Jangan gunakan radius identik.

Contoh:
- primary panel: `20px 20px 7px 20px`
- side panel: `20px 7px 20px 20px`
- smaller module: `13px 13px 4px 13px`
- button: `9px 9px 4px 9px`

Asymmetry harus subtle; jangan terlihat rusak.

## 7. Buttons

### Primary

Tactile, bukan neon-gradient.

```css
background: #B8EFF8;
color: #071118;
border: 1px solid rgba(223,250,255,.54);
border-radius: 9px 9px 4px 9px;
box-shadow:
  inset 0 1px 0 rgba(255,255,255,.76),
  0 4px 0 rgba(3,15,21,.42),
  0 13px 28px rgba(0,0,0,.19);
```

Hover: naik `1px`.
Active: turun `2px` dan bottom shadow mengecil.

### Secondary

Sebisa mungkin text button atau hairline button, bukan filled card kecil.

Contoh:
`Lihat evidence →`
`Gunakan contoh →`

### Chips

Contoh saham jangan jadi pill.
Gunakan text + underline/hairline:

`ADRO / DIVIDEN`

Status boleh boxed tetapi radius kecil `4px`.

## 8. Cards

Card bukan default container.

Sebelum membuat card, tanyakan:
1. Apakah content perlu punya elevation?
2. Apakah separator + spacing sudah cukup?
3. Apakah card ini punya hierarchy berbeda dari parent?

Kalau jawabannya tidak, jangan buat card.

Card utama punya:
- mixed radius;
- translucent dark fill;
- hairline neutral;
- very small specular top highlight;
- no large cyan glow.

Untuk panel bersebelahan, beri bentuk berbeda supaya komposisi terasa designed.

## 9. Landing Page

### Navbar

Smoked glass bar.
Bukan floating pill besar.

Radius `12px 12px 5px 12px`.
Tidak ada glow.
CTA tactile cyan-light.

### Hero

Headline menjadi anchor utama.

Contoh:

**Sebelum ikut hype,  
cek dulu angkanya.**

Baris kedua boleh punya hand-drawn cyan underline yang sangat tipis dan sedikit tidak lurus.

Hero background:
- dark;
- one restrained blue illumination;
- subtle grid/cable;
- grain.

Jangan gunakan 10 glowing badges.

### Verification Machine

Tetap ada karena cocok dengan reference OneText.

Perubahan:
- floating card menjadi translucent labels/plates;
- shape tiap plate berbeda;
- glow dikurangi;
- text lebih editorial;
- animation drift lebih lambat;
- central core tetap technical tapi bukan pusat neon besar.

### Product Showcase

Device frame lebih seperti material/slab:
- border tipis;
- radius tidak terlalu besar;
- stronger shadow from depth, bukan glow;
- UI internal padat dan tenang.

## 10. App Shell

Sidebar dan topbar dibuat “barely there”.

Sidebar:
- dark translucent surface;
- active item pakai 2px cyan indicator;
- background active sangat tipis;
- no glowing icon.

Topbar:
- smoked glass;
- small mono instrumentation di kanan;
- hierarchy utama tetap workspace.

## 11. Check Page

### Source tabs

Jangan berupa 4 rectangular segmented cards.

Gunakan **typographic tab rail**:
- icon + label;
- metadata kecil;
- separator line di bawah;
- active tab punya 2px cyan underline.

Modes:
- Teks
- Screenshot
- Link video
- Unggah video

Keempatnya tetap ada.

### Input surface

Input/media area adalah **inset material**, bukan floating card kedua.

- radius `15px 15px 5px 15px`
- fill lebih gelap dari parent
- focus ring hanya 2px transparent cyan
- scanning line sangat subtle

### Right preview

Harus terasa sebagai satu composition.
Hindari “card berisi empat card”.

Gunakan typography, dividers, one metric flow, dan context block.

## 12. Media Input

Screenshot:
- large drop surface;
- minimal dashed border;
- file preview mengambil mayoritas area;
- action berada di bawah, bukan giant CTA.

Video link:
- URL field
- one simple `VIDEO → TRANSCRIPT → CLAIMS` spatial pipeline
- jangan membuat setiap node seperti glowing pill.

Upload video:
- preview surface yang sama seperti screenshot;
- technical file metadata kecil.

Hasil “OCR/transcript” tetap berupa editable text panel karena backend belum diintegrasikan.

## 13. Analysis State

Live trace tidak diubah menjadi chat.

Gunakan:
- vertical path;
- event rows tanpa card kalau tidak perlu;
- active stage punya ring;
- Context Hunter boleh berubah tone sedikit ke violet/amber.

Motion:
- 140–220ms hover/state
- 350–600ms composition transition
- ambient drift 6–10s
- no glitch
- no bouncing

## 14. Result

Verdict headline harus paling dominan.

Jangan taruh semua evidence dalam card berbeda.
Pakai table/rows, separators, and one evidence inspector panel.

Status:
- amber = misleading
- lime = supported
- red = refuted
- violet = unverifiable
- neutral = out of scope

Status selalu punya icon/text; jangan bergantung warna saja.

## 15. Acceptance Check

Desain belum selesai kalau:
- masih terlihat seperti “dark SaaS dashboard template”;
- semua komponen punya rounded rectangle yang sama;
- font terasa sci-fi/game;
- terlalu banyak gradient cyan-violet;
- setiap hover memunculkan glow;
- hampir semua label uppercase mono;
- ada card kecil hanya untuk menampung satu angka;
- media input hilang;
- UI terlihat seperti hasil generator AI generik.

Desain dianggap sesuai kalau:
- typography terasa punya identitas;
- hierarchy bisa dibaca walau semua accent color dimatikan;
- material dark glass terasa physical;
- ada sedikit asymmetry/imperfection;
- cards dipakai selektif;
- CTA terasa tactile;
- layout tetap serius untuk produk finansial;
- futuristic feel muncul dari composition dan detail, bukan neon.
