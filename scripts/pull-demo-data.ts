/**
 * Memanaskan cache untuk 15 emiten demo (bab 6.4, bab 8.1 B nomor 1).
 *
 * Anggaran pos B hanya 250 kredit dan tidak bisa diisi ulang, jadi skrip ini
 * tidak pernah menembak API tanpa diminta dua kali: jalannya menghitung dan
 * mencetak estimasi dulu, dan baru benar-benar menarik data bila diberi `--yes`.
 *
 *   npx tsx scripts/pull-demo-data.ts                 # estimasi saja
 *   npx tsx scripts/pull-demo-data.ts --yes           # tarik data tipe 1-3
 *   npx tsx scripts/pull-demo-data.ts --full --yes    # tambah tipe 4-7
 *   npx tsx scripts/pull-demo-data.ts --yes --only ADRO,BBRI
 */
import { pathToFileURL } from 'node:url';
import { createSectorsClient, estimateCredits, windowEndingToday } from '@cek-dulu/sectors';
import type { ReportSection } from '@cek-dulu/sectors';

/** Bab 6.4. Emiten ke-15 adalah saham lapis bawah yang sedang ramai; bisa diganti lewat env. */
export const DEMO_TICKERS = [
  'ADRO',
  'BBRI',
  'BBCA',
  'BMRI',
  'TLKM',
  'ASII',
  'BREN',
  'GOTO',
  'ANTM',
  'PTBA',
  'UNVR',
  'ICBP',
  'AMAR',
  'CUAN',
  process.env.DEMO_SMALLCAP ?? 'RAJA',
];

const CORE_SECTIONS: ReportSection[] = ['overview', 'valuation', 'dividend'];
const FULL_SECTIONS: ReportSection[] = [...CORE_SECTIONS, 'financials'];

type Plan = {
  ticker: string;
  step: string;
  credits: number;
  run: () => Promise<unknown>;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const confirmed = args.includes('--yes');
  const full = args.includes('--full');

  const onlyArg = args.find((a) => a.startsWith('--only'));
  const only = onlyArg?.includes('=')
    ? onlyArg.split('=')[1]
    : onlyArg
      ? args[args.indexOf(onlyArg) + 1]
      : undefined;
  const tickers = only ? only.split(',').map((t) => t.trim().toUpperCase()) : DEMO_TICKERS;

  // Pemanasan cache harus benar-benar memanggil API, jadi mode dipaksa live.
  const { client } = createSectorsClient({ config: { mode: 'live', member: 'B' } });
  const price = windowEndingToday(90);
  const broker = windowEndingToday(14);
  const year = new Date().getFullYear();
  const sections = full ? FULL_SECTIONS : CORE_SECTIONS;

  const plans: Plan[] = [];
  for (const ticker of tickers) {
    plans.push({
      ticker,
      step: `company-report (${sections.join(', ')})`,
      credits: estimateCredits('fetchCompanyReport', { sections }),
      run: () => client.fetchCompanyReport(ticker, sections),
    });
    plans.push({
      ticker,
      step: 'daily 90 hari',
      credits: estimateCredits('fetchDailyPrice', {}),
      run: () => client.fetchDailyPrice(ticker, price),
    });
    plans.push({
      ticker,
      step: 'corporate-actions',
      credits: estimateCredits('fetchCorporateActions', {}),
      run: () => client.fetchCorporateActions(ticker),
    });

    if (full) {
      plans.push({
        ticker,
        step: 'foreign-flow 90 hari',
        credits: estimateCredits('fetchForeignFlow', {}),
        run: () => client.fetchForeignFlow(ticker, price),
      });
      plans.push({
        ticker,
        step: 'quarterly-financials 5 kuartal',
        credits: estimateCredits('fetchQuarterlyFinancials', { n_quarters: 5 }),
        run: () => client.fetchQuarterlyFinancials(ticker, { n_quarters: 5 }),
      });
      plans.push({
        ticker,
        step: 'broker-summary 14 hari',
        credits: estimateCredits('fetchBrokerSummary', {}),
        run: () => client.fetchBrokerSummary(ticker, broker),
      });
      plans.push({
        ticker,
        step: 'shareholders-composition',
        credits: estimateCredits('fetchShareholdersComposition', {}),
        run: () => client.fetchShareholdersComposition(ticker, year),
      });
      plans.push({
        ticker,
        step: 'suspensions',
        credits: estimateCredits('fetchSuspensions', {}),
        run: () => client.fetchSuspensions({ symbol: ticker }),
      });
    }
  }

  const estimate = plans.reduce((s, p) => s + p.credits, 0);
  console.log(`Emiten: ${tickers.length} (${tickers.join(', ')})`);
  console.log(`Langkah: ${plans.length}`);
  console.log(`Estimasi kredit maksimum: ${estimate} (pos B punya 250)`);

  if (!confirmed) {
    console.log('\nJalankan ulang dengan --yes untuk benar-benar menarik data.');
    return;
  }
  if (process.env.SECTORS_API_KEY === undefined || process.env.SECTORS_API_KEY === '') {
    console.error('SECTORS_API_KEY belum diisi.');
    process.exitCode = 1;
    return;
  }

  let spent = 0;
  let failed = 0;
  for (const plan of plans) {
    try {
      const result = (await plan.run()) as { credits: number; cached: boolean };
      spent += result.credits;
      console.log(
        `  ok   ${plan.ticker.padEnd(5)} ${plan.step.padEnd(34)} ` +
          `${result.credits} kredit${result.cached ? ' (cache)' : ''}`,
      );
    } catch (err) {
      failed += 1;
      console.warn(`  GAGAL ${plan.ticker.padEnd(5)} ${plan.step.padEnd(34)} ${String(err)}`);
    }
  }

  console.log(`\nSelesai. ${spent} kredit terpakai, ${failed} langkah gagal.`);
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
