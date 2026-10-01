import { ArrowUpRight, CheckCheck, Database } from 'lucide-react';

export default function SiteFooter() {
  return <footer className="site-footer" aria-label="Informasi Cek Dulu">
    <div className="footer-identity">
      <div className="footer-signature">
        <span className="footer-wordmark"><span className="brand-mark"><CheckCheck size={22} strokeWidth={3} aria-hidden="true" /></span><span>cek<span className="brand-light">dulu</span><span className="brand-period">.</span></span></span>
        <span className="footer-copyright">© {new Date().getFullYear()} Cek Dulu</span>
      </div>
      <div className="footer-source"><span><Database size={15} aria-hidden="true" /> Sumber data saham</span><a href="https://docs.sectors.app" target="_blank" rel="noreferrer" aria-label="Dokumentasi sumber data Sectors (tab baru)">Sectors <ArrowUpRight size={17} aria-hidden="true" /></a></div>
    </div>
    <section className="footer-disclaimer" aria-labelledby="footer-disclaimer-title">
      <h2 id="footer-disclaimer-title" className="sr-only">Catatan pemeriksaan</h2>
      <div><p className="footer-principle">Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi.</p><p>Status klaim menilai kesesuaian klaim dengan data yang tersedia, bukan kelayakan membeli atau menjual saham.</p></div>
      <div><p>Data bersumber dari Sectors dan dapat tertinggal dari kondisi terkini.</p><p>Lakukan riset sendiri sebelum mengambil keputusan.</p></div>
    </section>
  </footer>;
}
