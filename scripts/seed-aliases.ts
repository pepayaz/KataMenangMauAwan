/**
 * Mengisi tabel `ticker_aliases` (bab 3.3, bab 8.1 B nomor 2).
 *
 * Dua sumber:
 *   - `emiten`: daftar resmi dari Sectors. Nama perusahaan dipecah menjadi
 *     beberapa bentuk karena orang jarang menulis "PT Bank Central Asia Tbk."
 *   - `manual`: alias slang yang dikumpulkan B dan D dari konten nyata,
 *     dibundel di `@cek-dulu/shared`.
 *
 *   npx tsx scripts/seed-aliases.ts          # dari cache bila ada, tanpa memanggil API
 *   npx tsx scripts/seed-aliases.ts --fetch  # tarik ulang daftar emiten berhalaman (1 kredit per halaman)
 */
import { pathToFileURL } from 'node:url';
import { MANUAL_ALIASES, IDX_COMPANIES, normalizeTicker } from '@cek-dulu/shared';
import { createSectorsClient } from '@cek-dulu/sectors';

export type AliasRow = { alias: string; ticker: string; source: 'emiten' | 'manual'; weight: number };

/** Kata yang tidak membedakan apa pun bila berdiri sendiri sebagai alias. */
const STOPWORDS = new Set([
  'pt',
  'tbk',
  'persero',
  'indonesia',
  'international',
  'internasional',
  'group',
  'grup',
  'company',
  'corporation',
  'corp',
  'holding',
  'holdings',
  'sejahtera',
  'makmur',
  'jaya',
  'abadi',
  'utama',
  'mandiri',
]);

/**
 * Membuat beberapa bentuk alias dari satu nama perusahaan resmi. Murni.
 *
 * "PT Adaro Energy Indonesia Tbk." menghasilkan "adaro energy indonesia" dan
 * "adaro energy" dan "adaro". Bentuk yang lebih pendek diberi bobot lebih rendah
 * karena lebih mungkin bertabrakan dengan emiten lain.
 */
export function aliasesFromCompanyName(symbol: string, companyName: string): AliasRow[] {
  const ticker = normalizeTicker(symbol);
  const cleaned = companyName
    .toLowerCase()
    .replace(/\bpt\.?\b/g, ' ')
    .replace(/\btbk\.?\b/g, ' ')
    .replace(/\(persero\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned === '') return [];

  const words = cleaned.split(' ');
  const rows = new Map<string, AliasRow>();
  const add = (alias: string, weight: number): void => {
    if (alias.length < 4) return;
    if (STOPWORDS.has(alias)) return;
    const existing = rows.get(alias);
    if (!existing || existing.weight < weight) {
      rows.set(alias, { alias, ticker, source: 'emiten', weight });
    }
  };

  add(cleaned, 1.0);
  if (words.length > 2) add(words.slice(0, 2).join(' '), 0.85);
  const first = words[0];
  // Satu kata pertama hanya berguna bila ia bukan kata umum seperti "bank".
  if (first !== undefined && !STOPWORDS.has(first) && !['bank', 'sumber'].includes(first)) {
    add(first, 0.7);
  }
  add(ticker.toLowerCase(), 1.0);

  return [...rows.values()];
}

/** Menggabungkan dua sumber; alias manual menang bila bertabrakan. Murni. */
export function mergeAliases(fromEmiten: AliasRow[], manual: AliasRow[]): AliasRow[] {
  const byAlias = new Map<string, AliasRow>();
  for (const row of fromEmiten) byAlias.set(row.alias, row);
  for (const row of manual) byAlias.set(row.alias, row);
  return [...byAlias.values()].sort((a, b) => a.alias.localeCompare(b.alias));
}

async function main(): Promise<void> {
  const shouldFetch = process.argv.includes('--fetch');
  const { client, db } = createSectorsClient({
    config: shouldFetch ? { mode: 'live', member: 'B' } : { member: 'B' },
  });

  let emitenRows = IDX_COMPANIES.flatMap(c => aliasesFromCompanyName(c.symbol, c.company_name));
  if (shouldFetch) {
    const fetched: AliasRow[] = [];
    let offset = 0;
    for (let page = 0; page < 8; page++) {
      const companies = await client.fetchCompanies({ limit: 200, offset });
      fetched.push(...companies.data.companies.flatMap(c => aliasesFromCompanyName(c.symbol, c.company_name)));
      const next = companies.data.pagination.next_offset;
      if (next === null) { emitenRows = fetched; break; }
      if (next <= offset || page === 7) throw new Error('Daftar emiten belum lengkap; alias tidak ditulis.');
      offset = next;
    }
  }

  const manualRows: AliasRow[] = MANUAL_ALIASES.map((m) => ({
    alias: m.alias.toLowerCase(),
    ticker: normalizeTicker(m.ticker),
    source: 'manual',
    weight: m.weight,
  }));

  const rows = mergeAliases(emitenRows, manualRows);
  console.log(
    `Total alias: ${rows.length} (${emitenRows.length} dari daftar emiten, ${manualRows.length} manual).`,
  );

  if (!db) {
    console.log('Supabase tidak tersambung; tidak ada yang ditulis.');
    return;
  }

  // Ditulis per potongan supaya satu baris bermasalah tidak menggagalkan semuanya.
  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await db.from('ticker_aliases').upsert(chunk, { onConflict: 'alias' });
    if (error) console.error(`  gagal menulis potongan ${i / CHUNK + 1}: ${error.message}`);
    else written += chunk.length;
  }
  console.log(`${written} alias tersimpan ke ticker_aliases.`);
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
