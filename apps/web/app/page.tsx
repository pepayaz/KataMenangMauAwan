/**
 * Halaman ini milik C (bab 8.1 C). Yang ada sekarang hanya penanda supaya
 * `next build` jalan dan backend bisa diuji dari mesin mana pun tanpa menunggu UI.
 */
export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>Cek Dulu</h1>
      <p>Backend siap. Halaman cek dan rapor dikerjakan C.</p>
      <ul>
        <li>
          <code>POST /api/check</code> — mulai cek, balasannya aliran SSE.
        </li>
        <li>
          <code>GET /api/history</code> — riwayat dan perubahan status.
        </li>
        <li>
          <a href="/admin/credits">/admin/credits</a> — sisa kredit per pos.
        </li>
      </ul>
      <p style={{ color: '#666', fontSize: '0.875rem', marginTop: '2rem' }}>
        Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi.
      </p>
    </main>
  );
}
