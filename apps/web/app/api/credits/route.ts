import { getServiceClient } from '@cek-dulu/sectors';
import { isAdminRequest } from '@/lib/auth';
import { buildCreditsReport } from '@/lib/credits';

/**
 * GET /api/credits — sisa anggaran 1.000 kredit per pos (bab 6.3).
 *
 * Dipakai dasbor /admin/credits dan skrip laporan kredit harian pukul 21:00.
 * Internal: tidak pernah terbuka untuk pengguna aplikasi.
 *
 * Agregasinya ada di `lib/credits.ts`; route handler Next hanya boleh
 * mengekspor metode HTTP.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  if (!isAdminRequest(req)) {
    return Response.json({ error: 'Perlu ADMIN_TOKEN.' }, { status: 401 });
  }

  const db = getServiceClient();
  if (!db) return Response.json({ error: 'Basis data tidak tersambung.' }, { status: 503 });

  return Response.json(await buildCreditsReport(db));
}
