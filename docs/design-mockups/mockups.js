const icons = {
  check: '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
  text: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  warning: '<path d="m10 3-8 14a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 3a2 2 0 0 0-4 0z"/><path d="M12 8v5M12 16h.01"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  source: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
};
const icon = (name) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
const brand = () => `<div class="brand"><span class="brand-mark">${icon('check')}</span><span>cek<span class="brand-light">dulu</span><span class="brand-period">.</span></span></div>`;
const appHeader = () => `<header class="app-header">${brand()}<nav aria-label="Navigasi contoh"><span class="active">Periksa klaim</span><span>Riwayat pemeriksaan</span><span>Rapor tersimpan</span><span>Tentang Cek Dulu</span></nav></header>`;
const footer = () => `<footer class="app-footer"><div class="footer-top"><span class="footer-name">cekdulu.</span><span>Sumber data saham <span class="source-attribution">Sectors</span></span></div><div class="footer-copy"><p>Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi. Status klaim menilai kesesuaian klaim dengan data yang tersedia, bukan kelayakan membeli atau menjual saham.</p><p>Data bersumber dari Sectors dan dapat tertinggal dari kondisi terkini. Lakukan riset sendiri sebelum mengambil keputusan.</p></div></footer>`;
const input = () => `<section class="input-panel" aria-label="Masukkan klaim"><h2>Masukkan klaim</h2><div class="input-modes" role="group" aria-label="Bentuk input">${[['text','Teks'],['image','Screenshot'],['link','Link video'],['video','Unggah video']].map(([i,t],n)=>`<button type="button" class="mode ${n===0?'selected':''}" aria-pressed="${n===0}">${icon(i)}<span>${t}</span></button>`).join('')}</div><div class="editor"><label for="text-${currentVariant}" class="visually-hidden">Teks klaim saham</label><textarea id="text-${currentVariant}" placeholder="Contoh: ADRO yield 25,5% setahun" readonly></textarea><span class="character-count">0 / 5.000</span></div><div class="input-actions"><span class="input-hint">Teks klaim saham</span><button type="button" class="primary-button" aria-disabled="true">Cek klaim ini</button></div><div class="examples"><span>Coba contoh</span><button type="button"><strong>ADRO</strong> Dividen</button><button type="button"><strong>BBCA</strong> Valuasi</button><button type="button"><strong>BBRI</strong> Prediksi</button></div></section>`;
const badge = () => `<span class="verdict">${icon('warning')}Benar tapi menyesatkan</span>`;
const chart = () => `<div class="comparison-chart" role="img" aria-label="Contoh historis: klaim yield 25,5 persen dan rata-rata tercatat 25,5 persen. Definisi rata-rata, bukan yield tahunan berulang. Skala grafik nol sampai tiga puluh persen."><div class="chart-row"><div class="chart-label"><span>Diklaim</span><strong>25,5%</strong></div><div class="bar-track"><div class="bar claim-bar"></div></div></div><div class="chart-row"><div class="chart-label"><span>Rata-rata tercatat</span><strong>25,5%</strong></div><div class="bar-track"><div class="bar evidence-bar"></div></div></div><div class="chart-axis"><span>0%</span><span>30%</span></div></div>`;
const context = () => `<div class="context-note"><div class="context-icon">${icon('layers')}</div><div><strong>Pembayaran khusus</strong><span class="context-amount">Rp1.358,18</span><p>Ada pembayaran khusus terkait pemisahan AADI.</p></div></div>`;
const preview = () => `<aside class="evidence-preview" aria-label="Contoh rapor historis"><div class="preview-heading"><span>Contoh historis</span><span>ADRO</span></div><p class="historical-warning">Angka contoh bukan data pasar terkini.</p><div class="preview-verdict">${badge()}</div><h2 class="claim-quote">“ADRO yield 25,5% setahun”</h2>${chart()}${context()}<div class="source-action">${icon('source')}<span>Lihat sumber</span><span class="evidence-count">6 bukti</span></div></aside>`;
const spatialPreview = () => `<aside class="spatial-preview" aria-label="Contoh historis dalam lapisan bukti"><div class="preview-heading"><span>Contoh historis</span><span>ADRO</span></div><p class="historical-warning">Angka contoh bukan data pasar terkini.</p><div class="preview-verdict">${badge()}</div><div class="layer-controls"><span>Klaim</span><span class="selected">Angka</span><span>Konteks</span></div><div class="layer-scene"><div class="rear-sheet rear-context"><span>Konteks</span></div><div class="rear-sheet rear-claim" aria-hidden="true"></div><section class="front-sheet"><h2 class="claim-quote">“ADRO yield 25,5% setahun”</h2>${chart()}${context()}<div class="source-action">${icon('source')}<span>Lihat sumber</span><span class="evidence-count">6 bukti</span></div></section></div></aside>`;
let currentVariant = 1;
const titles = ['Form pemeriksaan bertahap','Pemeriksaan berdampingan','Lapisan bukti spasial'];
const page = (variant) => {
  currentVariant = variant;
  const content = variant === 1 ? `<div class="focused-input">${input()}</div>` : variant === 2 ? `<div class="split-layout">${input()}${preview()}</div>` : `<div class="spatial-layout">${input()}${spatialPreview()}</div>`;
  return `<section class="variant-wrapper" aria-label="Arah ${variant}: ${titles[variant-1]}"><div class="variant-title"><a href="?view=${variant}">${variant}. ${titles[variant-1]}</a><span>1440 × 900</span></div><article class="screen variant-${variant}">${appHeader()}<main class="app-content"><h1>Periksa klaim saham</h1>${content}</main>${footer()}</article></section>`;
};
const params = new URLSearchParams(location.search);
const mobileTitles = ['Masukkan klaim','Tinjau pembacaan','Hasil pemeriksaan','Lihat sumber'];
const mobileSteps = (active) => `<ol class="flow-steps" aria-label="Tahap input media">${['Baca','Tinjau','Cek'].map((label,i)=>`<li ${i===active?'aria-current="step"':''}>${label}</li>`).join('')}</ol>`;
const mobileHeader = () => `<header class="mobile-header">${brand()}<details><summary>Menu</summary><nav><span>Periksa klaim</span><span>Riwayat pemeriksaan</span><span>Rapor tersimpan</span><span>Tentang Cek Dulu</span></nav></details></header>`;
const mobileFrame = (state) => {
  currentVariant = `mobile-${state}`;
  let content;
  if (state===1) content = `${input()}<details class="mobile-help"><summary>Cara membaca screenshot atau video</summary><p>Pilih jenis input. Baca isi media, tinjau teksnya, lalu periksa klaim.</p><a href="?mobile=2">Lihat contoh peninjauan</a></details>`;
  if (state===2) content = `${mobileSteps(1)}<section class="input-panel"><div class="media-file">${icon('video')}<div><strong>Contoh peninjauan video</strong><span>Mockup; bukan hasil transkripsi baru</span></div></div><p class="review-warning">Periksa ticker dan angka sebelum melanjutkan.</p><label class="review-label" for="review-text">Teks untuk diperiksa</label><div class="editor"><textarea id="review-text" readonly>ADRO yield 25,5% setahun</textarea><span class="character-count">24 / 5.000</span></div><details class="mobile-help"><summary>Jika ada bagian yang tidak terbaca</summary><p>Koreksi teks atau gunakan screenshot bagian yang memuat klaim. Caption saja tidak berarti isi video sudah dibaca.</p></details><a class="primary-button mobile-action" href="?mobile=3">Lihat contoh hasil</a><details class="media-states"><summary>Contoh keadaan membaca dan gagal</summary><div class="reading-state"><span class="static-spinner" aria-hidden="true"></span><strong>Membaca audio dan tulisan…</strong></div><p>Belum ada persentase progres yang dapat ditampilkan.</p><div class="error-state"><strong>Video tidak dapat diakses</strong><p>Unggah video, gunakan screenshot, atau tempel teks.</p><button class="primary-button" type="button">Unggah video</button></div></details></section>`;
  if (state===3) content = `<div class="historical-banner">Contoh historis ADRO · bukan data terkini</div><section class="evidence-preview">${badge()}<h2 class="claim-quote">“ADRO yield 25,5% setahun”</h2>${chart()}${context()}<a class="source-action" href="?mobile=4">${icon('source')}<span>Lihat sumber</span><span class="evidence-count">6 bukti</span></a><details class="mobile-help"><summary>Penjelasan lengkap</summary><p>Angka rata-rata penyedia 25,5% bukan jaminan yield tahunan berulang. Rata-rata mandiri sekitar 23,6% memakai rumus jumlah yield tahunan dibagi jumlah tahun. Ada pembayaran khusus Rp1.358,18 dengan yield 45,2% terkait pemisahan AADI. Data dividen terbaru perlu dikonfirmasi sebelum menilai selisih TTM.</p></details></section><a class="back-link" href="?mobile=1">Periksa klaim lain</a>`;
  if (state===4) content = `<a class="back-link" href="?mobile=3">Kembali ke hasil</a><div class="historical-banner">Contoh historis ADRO · bukan data terkini</div><section class="evidence-preview">${badge()}<h2 class="claim-quote">“ADRO yield 25,5% setahun”</h2><h3 class="source-heading">Angka dan definisinya</h3>${chart()}<p class="source-qualification">Angka rata-rata penyedia, bukan yield rutin setiap tahun.</p><details class="mobile-help" open><summary>Hitungan mandiri · sekitar 23,6%</summary><p>Periode 2021–2025. Jumlah yield tahunan ÷ jumlah tahun.</p><p>Ringkasan AGENTS.md; data tahunan mentah tidak tersedia pada fixture ini.</p></details><h3 class="source-heading">Bukti pembayaran khusus</h3><dl class="source-values"><div><dt>Pembayaran</dt><dd>Rp1.358,18</dd></div><div><dt>Yield pembayaran</dt><dd>45,2%</dd></div><div><dt>Tanggal</dt><dd>28 Nov 2024</dd></div></dl><p class="source-qualification">Terkait pemisahan AADI.</p><details class="mobile-help"><summary>Asal dan nilai lengkap</summary><p>Sumber: Sectors, company report bagian dividend. Data contoh diverifikasi 23 Sep 2026.</p><dl class="source-values"><div><dt>Rata-rata penyedia</dt><dd>0,255</dd></div><div><dt>Yield TTM</dt><dd>5,56%</dd></div><div><dt>Cash payout ratio</dt><dd>−0,897x</dd></div></dl><p>TTM memakai periode berbeda. Belum ada data dividen 2026 pada contoh; jangan menganggap selisihnya sebagai penurunan yang sudah terkonfirmasi.</p></details></section>`;
  return `<section class="variant-wrapper palette-2 mobile-wrapper"><div class="variant-title"><a href="?mobile=${state}">${state}. ${mobileTitles[state-1]}</a><span>390 × 844</span></div><article class="screen mobile-screen">${mobileHeader()}<main class="mobile-content"><h1>${state===1?'Periksa klaim saham':mobileTitles[state-1]}</h1>${content}</main>${footer()}</article></section>`;
};
const selectedView = Number(params.get('view'));
const paletteMode = params.has('palette');
const paletteChoice = Number(params.get('palette'));
const paletteNames = ['Grafit–jade','Slate–biru','Arang–bronze'];
if (params.has('mobile')) {
  const choice = Number(params.get('mobile'));
  const choices = [1,2,3,4].includes(choice) ? [choice] : [1,2,3,4];
  document.body.classList.add('palette-review','mobile-review');
  document.body.classList.toggle('mobile-single', choices.length===1);
  document.querySelector('#mockups').innerHTML = choices.map(mobileFrame).join('');
  document.querySelector('.review-toolbar strong').textContent = 'Cek Dulu — slate–biru di mobile';
  document.querySelector('.review-toolbar span').textContent = 'Mockup alur · tidak membaca video atau memanggil API';
  document.querySelector('.review-toolbar nav').innerHTML = `<a href="?mobile=all">Semua layar</a><a href="?palette=2">Desktop</a>`;
} else if (paletteMode) {
  const choices = [1,2,3].includes(paletteChoice) ? [paletteChoice] : [1,2,3];
  document.body.classList.add('palette-review');
  document.body.classList.toggle('single-view', choices.length === 1);
  document.body.classList.toggle('gallery-view', choices.length > 1);
  document.querySelector('#mockups').innerHTML = choices.map(choice => {
    const template = document.createElement('template');
    template.innerHTML = page(2);
    const wrapper = template.content.firstElementChild;
    wrapper.classList.add(`palette-${choice}`);
    wrapper.querySelector('.variant-title a').textContent = `${choice}. ${paletteNames[choice-1]}`;
    wrapper.querySelector('.variant-title a').href = `?palette=${choice}`;
    wrapper.setAttribute('aria-label', paletteNames[choice-1]);
    const field = wrapper.querySelector('textarea');
    field.id = `palette-text-${choice}`;
    wrapper.querySelector('label').htmlFor = field.id;
    field.value = 'ADRO yield 25,5% setahun';
    field.textContent = field.value;
    wrapper.querySelector('.character-count').textContent = `${field.value.length} / 5.000`;
    wrapper.querySelector('.primary-button').removeAttribute('aria-disabled');
    return wrapper.outerHTML;
  }).join('');
  document.querySelector('.review-toolbar strong').textContent = 'Cek Dulu — pilihan palet';
  document.querySelector('.review-toolbar span').textContent = 'Layout sama · teks contoh terisi · tombol tetap statis';
  document.querySelector('.review-toolbar nav').innerHTML = `<a href="?palette=all">Bandingkan</a>${paletteNames.map((name,i)=>`<a href="?palette=${i+1}">${i+1}. ${name}</a>`).join('')}<a href="?view=all">Layout awal</a>`;
} else {
const single = [1,2,3].includes(selectedView);
document.body.classList.toggle('single-view', single);
document.body.classList.toggle('gallery-view', !single);
document.querySelector('#mockups').innerHTML = (single ? [selectedView] : [1,2,3]).map(page).join('');
document.querySelectorAll('.review-toolbar a').forEach(a=>{ if(new URL(a.href).searchParams.get('view')===(single?String(selectedView):'all'))a.setAttribute('aria-current','page'); });
}
const resizeGallery = () => document.body.style.setProperty('--mockup-scale', String(Math.max(0.24,(window.innerWidth-96)/4320)));
resizeGallery();
window.addEventListener('resize', resizeGallery);
