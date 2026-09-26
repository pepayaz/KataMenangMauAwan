import CheckForm from './check-form';
import { isFixtureDemoEnabled } from '../lib/fixture-demo';

export const dynamic = 'force-dynamic';
export default function Home() {
  return <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 760, margin: 'auto' }}>
    <h1>Cek Dulu</h1><p>Periksa kesesuaian klaim saham dengan data yang tersedia.</p>
    <CheckForm fixtureDemo={isFixtureDemoEnabled()} demoText="ADRO yield 25,5% setahun" />
    <footer style={{ color: '#555', marginTop: '2rem' }}>
      Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi. Status klaim menilai kesesuaian klaim dengan data yang tersedia, bukan kelayakan membeli atau menjual saham. Data bersumber dari Sectors dan dapat tertinggal dari kondisi terkini. Lakukan riset sendiri sebelum mengambil keputusan.
    </footer>
  </main>;
}
