import { ArrowRight, ArrowUpRight, ChartNoAxesCombined, Database, FileSearch, ScanText, ShieldCheck, Workflow, ChevronDown } from 'lucide-react';

export default function AboutContent() {
  return <section className="about-page">
    <header className="page-heading"><h1>Tentang Cek Dulu</h1><p>Pemeriksaan klaim saham Indonesia dari postingan, screenshot, dan video.</p></header>
    <div className="about-overview">
      <article className="about-method">
        <div className="about-section-title"><FileSearch size={21} aria-hidden="true" /><h2>Apa yang diperiksa?</h2></div>
        <p>Angka dalam klaim, periode pembanding, dan konteks yang mengubah maknanya.</p>
        <ol className="about-flow" aria-label="Alur pemeriksaan">
          <li><span className="about-flow-icon"><ScanText size={27} aria-hidden="true" /></span><div><strong>Isi konten</strong><span>Dipecah menjadi klaim terpisah</span></div></li>
          <li><span className="about-flow-icon"><ChartNoAxesCombined size={27} aria-hidden="true" /></span><div><strong>Angka & konteks</strong><span>Dibandingkan dengan data yang tersedia</span></div></li>
          <li><span className="about-flow-icon"><ShieldCheck size={27} aria-hidden="true" /></span><div><strong>Rapor klaim</strong><span>Status, pembanding, dan sumber</span></div></li>
        </ol>
        <a href="/check?view=guide" className="about-detail-link">Pelajari arti setiap status <ArrowRight size={17} aria-hidden="true" /></a>
      </article>
      <div className="about-boundaries">
        <article><Workflow size={22} aria-hidden="true" /><div><h2>Peran AI</h2><p>Membaca konten dan menulis penjelasan. Perhitungan angka dan status ditentukan oleh aturan program.</p></div></article>
        <article><Database size={22} aria-hidden="true" /><div><h2>Asal data</h2><p>Data saham bersumber dari Sectors. Periode dan waktu pengambilan tersedia di setiap bukti.</p><a href="https://docs.sectors.app" target="_blank" rel="noreferrer">Dokumentasi sumber <ArrowUpRight size={15} aria-hidden="true" /></a></div></article>
        <article className="about-limit"><ShieldCheck size={22} aria-hidden="true" /><div><h2>Batas pemeriksaan</h2><p>Prediksi dan opini berada di luar cakupan. Data kosong tidak cukup untuk mendukung atau membantah klaim.</p></div></article>
      </div>
    </div>
    <section className="about-faq" aria-labelledby="about-faq-title">
      <h2 id="about-faq-title">Hal yang perlu diketahui</h2>
      <details><summary>Angka benar, mengapa bisa menyesatkan?<ChevronDown size={18} aria-hidden="true" /></summary><p>Pembayaran dividen khusus, periode yang berbeda, atau basis pembanding rendah bisa mengubah arti sebuah angka. Rapor menunjukkan konteks tersebut beserta bukti pendukungnya.</p></details>
      <details><summary>Apakah data selalu terbaru?<ChevronDown size={18} aria-hidden="true" /></summary><p>Tidak selalu. Data dapat tertinggal dari kondisi pasar. Periksa periode dan waktu pengambilan di bagian sumber; contoh historis diberi label terpisah.</p></details>
      <details><summary>Bagaimana dengan screenshot dan video?<ChevronDown size={18} aria-hidden="true" /></summary><p>Hasil pembacaan perlu ditinjau sebelum diperiksa. Koreksi ticker, angka, dan teks yang keliru. Jika platform membatasi akses video, gunakan unggah video, screenshot, atau teks.</p></details>
      <details><summary>Apa yang tersimpan di riwayat?<ChevronDown size={18} aria-hidden="true" /></summary><p>Riwayat browser menyimpan teks dan hasil pemeriksaan. Jika penyimpanan server tersedia, rapor juga dapat tersimpan di server. Media diproses sementara; berkas screenshot dan video tidak disimpan sebagai riwayat.</p></details>
    </section>
    <div className="about-bottom"><a className="primary-button" href="/check">Periksa klaim <ArrowRight size={18} aria-hidden="true" /></a><details className="about-version"><summary>Informasi versi</summary><p className="build-revision">Revisi sumber saat build: {process.env.NEXT_PUBLIC_SOURCE_REVISION ?? 'tidak tersedia'}</p></details></div>
  </section>;
}
