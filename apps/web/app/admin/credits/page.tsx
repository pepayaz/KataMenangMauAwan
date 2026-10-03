import { getServiceClient } from '@cek-dulu/sectors';
import { buildCreditsReport, type CreditsReport } from '@/lib/credits';

/**
 * Dasbor kredit internal (bab 6.3: "Dasbor kecil /admin/credits menampilkan
 * sisa kredit per pos dari buku kredit"). Pemilik: B.
 *
 * Sengaja tanpa gaya berat: ini alat kerja tim selama tujuh hari, bukan bagian
 * produk. Yang penting satu angka terbaca dari seberang meja — sisa kredit.
 */

export const dynamic = 'force-dynamic';

export default async function CreditsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const searchParams = await props.searchParams;
  const expected = process.env.ADMIN_TOKEN;
  const supplied = typeof searchParams.token === 'string' ? searchParams.token : '';

  if (expected && expected !== '' && supplied !== expected) {
    return (
      <main style={styles.main}>
        <h1 style={styles.h1}>Dasbor kredit</h1>
        <p>Tambahkan <code>?token=…</code> yang cocok dengan ADMIN_TOKEN.</p>
      </main>
    );
  }

  const db = getServiceClient();
  if (!db) {
    return (
      <main style={styles.main}>
        <h1 style={styles.h1}>Dasbor kredit</h1>
        <p>Supabase belum tersambung. Isi SUPABASE_SERVICE_ROLE_KEY di .env.local.</p>
      </main>
    );
  }

  const report: CreditsReport = await buildCreditsReport(db);
  const pctLeft = Math.round((report.total.left / report.total.budget) * 100);

  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>Dasbor kredit Sectors</h1>

      <section style={styles.headline}>
        <div style={styles.bigNumber}>{report.total.left}</div>
        <div>
          <div>
            kredit tersisa dari {report.total.budget} ({pctLeft}%)
          </div>
          <div style={styles.muted}>
            Hari ini: {report.today.used} kredit dari {report.today.calls} panggilan,{' '}
            {report.today.cachedCalls} dilayani cache.
          </div>
        </div>
      </section>

      <h2 style={styles.h2}>Sisa per pos anggaran</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Pos</th>
            <th style={styles.thNum}>Anggaran</th>
            <th style={styles.thNum}>Terpakai</th>
            <th style={styles.thNum}>Sisa</th>
            <th style={styles.thNum}>Panggilan</th>
          </tr>
        </thead>
        <tbody>
          {report.members.map((m) => (
            <tr key={m.member}>
              <td style={styles.td}>{m.member}</td>
              <td style={styles.tdNum}>{m.budget}</td>
              <td style={styles.tdNum}>{m.used}</td>
              <td style={{ ...styles.tdNum, color: m.left <= 0 ? '#b3261e' : undefined }}>
                {m.left}
              </td>
              <td style={styles.tdNum}>{m.calls}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={styles.h2}>Kredit per endpoint</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Endpoint</th>
            <th style={styles.thNum}>Kredit</th>
            <th style={styles.thNum}>Panggilan</th>
            <th style={styles.thNum}>Dari cache</th>
          </tr>
        </thead>
        <tbody>
          {report.byEndpoint.map((e) => (
            <tr key={e.endpoint}>
              <td style={styles.td}>{e.endpoint}</td>
              <td style={styles.tdNum}>{e.credits}</td>
              <td style={styles.tdNum}>{e.calls}</td>
              <td style={styles.tdNum}>
                {e.calls > 0 ? `${Math.round((e.cachedCalls / e.calls) * 100)}%` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={styles.h2}>50 panggilan terakhir</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Waktu</th>
            <th style={styles.th}>Endpoint</th>
            <th style={styles.th}>Pos</th>
            <th style={styles.thNum}>Kredit</th>
            <th style={styles.th}>Cache</th>
          </tr>
        </thead>
        <tbody>
          {report.recent.map((r, i) => (
            <tr key={`${r.ts}-${i}`}>
              <td style={styles.td}>{r.ts.replace('T', ' ').slice(0, 19)}</td>
              <td style={styles.td}>{r.endpoint}</td>
              <td style={styles.td}>{r.member}</td>
              <td style={styles.tdNum}>{r.credits}</td>
              <td style={styles.td}>{r.cached ? 'ya' : 'tidak'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    maxWidth: 960,
    margin: '0 auto',
    padding: '2rem 1rem 4rem',
    lineHeight: 1.5,
  },
  h1: { fontSize: '1.5rem', marginBottom: '1.5rem' },
  h2: { fontSize: '1.05rem', margin: '2rem 0 0.5rem' },
  headline: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    border: '1px solid #ddd',
    borderRadius: 8,
  },
  bigNumber: { fontSize: '2.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  muted: { color: '#666', fontSize: '0.875rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { textAlign: 'left', borderBottom: '2px solid #ddd', padding: '0.4rem 0.5rem' },
  thNum: { textAlign: 'right', borderBottom: '2px solid #ddd', padding: '0.4rem 0.5rem' },
  td: { borderBottom: '1px solid #eee', padding: '0.35rem 0.5rem' },
  tdNum: {
    borderBottom: '1px solid #eee',
    padding: '0.35rem 0.5rem',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
};
