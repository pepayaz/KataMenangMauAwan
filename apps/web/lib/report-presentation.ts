import type { Claim, ClaimVerdict, Evidence, Verdict } from '@cek-dulu/shared/schemas';
import { formatEvidence, readableSourceText } from './check-view';

export const verdictSummaries: Record<Verdict, string> = {
  supported: 'Angka cocok dengan data pembanding dalam toleransi pemeriksaan.',
  refuted: 'Angka klaim berbeda dari data pembanding di luar toleransi pemeriksaan.',
  misleading: 'Angka cocok, tetapi ada konteks penting yang mengubah maknanya.',
  unverifiable: 'Data yang tersedia belum cukup untuk memastikan klaim ini.',
  out_of_scope: 'Prediksi atau opini tidak dapat dipastikan dengan data historis.',
};

/** Split prose for reading only; decimal separators and the original numbers stay intact. */
export function explanationParts(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z“"])/u);
}

export const verdictSignals: Record<Verdict, string[]> = {
  supported: ['Angka cocok', 'Dalam toleransi'], refuted: ['Angka berbeda', 'Di luar toleransi'],
  misleading: ['Angka cocok', 'Konteks terlewat'], unverifiable: ['Data belum cukup'], out_of_scope: ['Prediksi / opini'],
};
export const contextTitles: Record<string, string> = {
  DIV_ONE_OFF: 'Pembayaran khusus', DIV_TTM_GAP: 'Yield terkini berbeda', DIV_CASH_PAYOUT: 'Rasio pembayaran kas',
  DIV_SHARE_CHANGE: 'Jumlah saham berubah', VAL_PEER_GAP: 'Berbeda dari saham sejenis', VAL_OWN_HISTORY: 'Berbeda dari riwayat sendiri',
  VAL_NEG_PEG: 'Pertumbuhan laba negatif', VAL_ONE_OFF_EARNINGS: 'Laba tidak berulang', PRC_LOW_BASE: 'Berangkat dari harga rendah',
  PRC_THIN_LIQ: 'Transaksi tipis', PRC_WINDOW: 'Periode mengubah hasil', PRC_LOW_FLOAT: 'Saham publik terbatas', PRC_SPLIT: 'Ada stock split',
};

export type ChartObservation = { label: string; value: number; display: string; evidenceId?: string; detail: string };
export type SourceChart = { key: string; title: string; note: string; rows: ChartObservation[] };
/** Known yield fields are snapshots of different definitions, never a fabricated timeline. */
export function sourceCharts(evidence: Evidence[], claim?: Claim, verdict?: ClaimVerdict): SourceChart[] {
  const charts: SourceChart[] = [];
  const yieldLabels: Record<string, string> = {
    'Angka Sectors dividend_yield_avg.avg_yield': 'Rata-rata Sectors', 'Yield TTM': '12 bulan terakhir',
    'Yield pembayaran khusus': 'Pembayaran khusus',
    'Rata-rata mandiri sekitar 23,6%; ringkasan AGENTS.md, bukan dihitung ulang dari data tahunan di fixture': 'Rata-rata mandiri',
  };
  const yieldMetrics: Record<string, string> = { 'dividend.avg_yield': 'Rata-rata Sectors', 'dividend.yield_ttm': '12 bulan terakhir' };
  const yields = evidence.flatMap(record => {
    const meta = record.params.hunter;
    const metric = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>).metric : undefined;
    const label = yieldLabels[record.label] ?? (typeof metric === 'string' ? yieldMetrics[metric] : undefined);
    if (!label || record.unit !== '%' || typeof record.value !== 'number' || !Number.isFinite(record.value)) return [];
    return [{ label, value: record.value, display: formatEvidence(record), evidenceId: record.evidenceId,
      detail: `${readableSourceText(record.label)} · ${formatEvidence(record, 20)}` }];
  });
  // Collapse exact duplicate observations, retaining their original provenance in all sources.
  const uniqueYields = yields.filter((row, index) => yields.findIndex(other => other.label === row.label && other.value === row.value) === index);
  if (uniqueYields.length >= 2) charts.push({ key: 'yield-snapshot', title: 'Perbandingan yield', note: 'Definisi berbeda · bukan urutan waktu', rows: uniqueYields });
  for (const group of evidenceSeries(evidence)) charts.push({ key: group.key, title: `${group.label} ${group.symbol}`, note: 'Riwayat per periode',
    rows: group.points.map(point => ({ label: point.period, value: point.value, display: formatEvidence({ value: point.value, unit: group.unit }),
      evidenceId: point.evidenceId, detail: `${point.period} · ${formatEvidence({ value: point.value, unit: group.unit }, 20)}` })) });
  if (verdict) {
    const pair = comparisonFor(claim, verdict);
    if (pair.values && evidence.some(record => record.evidenceId === verdict.computed?.evidenceId)) charts.push({ key: 'claim-comparison',
      title: 'Klaim vs data', note: 'Skala yang sama · dimulai dari nol', rows: [
        { label: 'Diklaim', value: pair.values[0], display: pair.left, detail: `Teks klaim · ${pair.exactLeft}` },
        { label: 'Pembanding', value: pair.values[1], display: pair.right, evidenceId: verdict.computed?.evidenceId, detail: `Data pembanding · ${pair.exactRight}` },
      ] });
  }
  return charts;
}

/** Display only: values and adjudication remain untouched. Never chart incompatible units. */
export function comparisonFor(claim: Claim | undefined, verdict: ClaimVerdict) {
  const unit = claim?.asserted.unit;
  const asserted = claim?.asserted.value;
  const left = asserted === undefined ? undefined : { value: unit === '%' ? asserted / 100 : asserted, unit };
  const right = verdict.computed;
  let digits = 2;
  // A refuted comparison must not look equal merely because display rounding hides the gap.
  if (left && right && verdict.verdict === 'refuted' && left.unit === right.unit && left.value !== right.value) {
    while (digits < 20 && formatEvidence(left, digits) === formatEvidence(right, digits)) digits++;
  }
  const compatible = left && right && left.unit === right.unit && Number.isFinite(left.value) && Number.isFinite(right.value);
  return {
    left: left ? formatEvidence(left, digits) : 'Tidak disebutkan',
    right: right ? formatEvidence(right, digits) : 'Belum tersedia',
    exactLeft: left ? formatEvidence(left, 20) : undefined,
    exactRight: right ? formatEvidence(right, 20) : undefined,
    values: compatible ? [left.value, right.value] as [number, number] : undefined,
  };
}

export type EvidenceSeries = { key: string; label: string; symbol: string; unit: string;
  points: { period: string; value: number; evidenceId: string }[] };
const chartMetrics = new Set(['dividend.total', 'dividend.payment', 'valuation.pe', 'valuation.pb', 'valuation.peg', 'daily.close', 'daily.volume']);

/** Only explicit metadata creates a series; labels, missing data and conflicting observations never do. */
export function evidenceSeries(evidence: Evidence[]): EvidenceSeries[] {
  const groups = new Map<string, EvidenceSeries>();
  const conflicts = new Set<string>();
  for (const record of evidence) {
    const meta = record.params.hunter;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) continue;
    const { metric, symbol, peer, year, date } = meta as Record<string, unknown>;
    if (typeof metric !== 'string' || !chartMetrics.has(metric) || typeof symbol !== 'string'
      || typeof record.value !== 'number' || !Number.isFinite(record.value) || !record.unit) continue;
    const period = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date
      : typeof year === 'number' && Number.isInteger(year) && year >= 1900 && year <= 2200 ? String(year) : undefined;
    if (!period) continue;
    const ticker = typeof peer === 'string' ? peer : symbol;
    const key = `${metric}:${ticker}:${record.unit}:${period.length === 4 ? 'year' : 'date'}`;
    const group = groups.get(key) ?? { key, label: readableSourceText(metric), symbol: ticker, unit: record.unit, points: [] };
    const existing = group.points.find(point => point.period === period);
    if (existing && existing.value !== record.value) conflicts.add(key);
    else if (!existing) group.points.push({ period, value: record.value, evidenceId: record.evidenceId });
    groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.points.length >= 2 && !conflicts.has(group.key))
    .map(group => ({ ...group, points: group.points.sort((a, b) => a.period.localeCompare(b.period)) }));
}

/** Shared zero axis supports negative observations, without implying interpolation or clipping. */
export function barScale(values: number[]) {
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const extent = max - min || 1;
  const zero = min === 0 ? 0 : -min / extent * 100;
  return { zero, bar: (value: number) => ({ left: value < 0 ? (value - min) / extent * 100 : zero,
    width: Math.abs(value) / extent * 100 }) };
}
