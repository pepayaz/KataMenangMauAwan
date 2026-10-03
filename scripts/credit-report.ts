/**
 * Laporan kredit harian (bab 6.3: "Setiap malam jam 21:00 sisa kredit
 * dilaporkan di chat tim"). Pemilik: B.
 *
 * Keluarannya teks siap tempel ke grup. Jalankan bersamaan dengan integrasi
 * harian pukul 21:00.
 *
 *   npx tsx scripts/credit-report.ts
 */
import { pathToFileURL } from 'node:url';
import { MEMBER_BUDGETS, TOTAL_BUDGET, getServiceClient } from '@cek-dulu/sectors';

type LedgerRow = {
  endpoint: string;
  credits: number;
  cached: boolean;
  member: string;
  ts: string;
};

export function renderReport(rows: LedgerRow[], sinceIso: string, now = new Date()): string {
  const perMember = new Map<string, number>();
  const perEndpointToday = new Map<string, number>();
  let todayCredits = 0;
  let todayCalls = 0;
  let todayCached = 0;

  for (const row of rows) {
    perMember.set(row.member, (perMember.get(row.member) ?? 0) + row.credits);
    if (row.ts >= sinceIso) {
      todayCredits += row.credits;
      todayCalls += 1;
      if (row.cached) todayCached += 1;
      perEndpointToday.set(row.endpoint, (perEndpointToday.get(row.endpoint) ?? 0) + row.credits);
    }
  }

  const totalUsed = [...perMember.values()].reduce((s, v) => s + v, 0);
  const left = TOTAL_BUDGET - totalUsed;

  const lines: string[] = [];
  lines.push(`Laporan kredit Sectors — ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  lines.push(`Sisa total: ${left} dari ${TOTAL_BUDGET} kredit.`);
  lines.push(
    `Hari ini: ${todayCredits} kredit, ${todayCalls} panggilan, ` +
      `${todayCalls > 0 ? Math.round((todayCached / todayCalls) * 100) : 0}% dilayani cache.`,
  );
  lines.push('');
  lines.push('Sisa per pos:');
  for (const [member, budget] of Object.entries(MEMBER_BUDGETS)) {
    const used = perMember.get(member) ?? 0;
    const remaining = budget - used;
    const flag = remaining <= 0 ? '  <- HABIS' : remaining < budget * 0.2 ? '  <- menipis' : '';
    lines.push(`  ${member.padEnd(9)} ${String(remaining).padStart(4)} / ${budget}${flag}`);
  }

  const top = [...perEndpointToday.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length > 0) {
    lines.push('');
    lines.push('Endpoint termahal hari ini:');
    for (const [endpoint, credits] of top) lines.push(`  ${endpoint}: ${credits}`);
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const db = getServiceClient();
  if (!db) {
    console.error('Supabase tidak tersambung; isi SUPABASE_SERVICE_ROLE_KEY.');
    process.exitCode = 1;
    return;
  }

  const { data, error } = await db
    .from('credit_ledger')
    .select('endpoint, credits, cached, member, ts')
    .order('ts', { ascending: false })
    .limit(10000);

  if (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  console.log(renderReport((data ?? []) as LedgerRow[], startOfToday.toISOString()));
}

/** Hanya berjalan saat dipanggil langsung, bukan saat diimpor uji unit. */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
