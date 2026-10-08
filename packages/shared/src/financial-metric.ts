/** Explicit Sectors quarterly fields; unknown metrics never fall back to earnings. */
export type FinancialMetric = { field: string; path: string[]; label: string; basis: 'flow' | 'stock' };
const entries: Array<[RegExp, FinancialMetric | null]> = [
  [/\b(segmen|segment|porsi|retained|laba ditahan|sisa laba)\b/i, null],
  [/\b(pendapatan provisi|fee income|commission income)\b/i, null],
  [/\b(non interest income|pendapatan non bunga)\b/i, { field: 'non_interest_income', path: ['non_interest_income'], label: 'Pendapatan non bunga', basis: 'flow' }],
  [/\b(saldo cadangan|allowance for loans|cadangan kerugian kredit)\b/i, { field: 'allowance_for_loans', path: ['financials_sector_metrics', 'allowance_for_loans'], label: 'Saldo cadangan kerugian kredit', basis: 'stock' }],
  [/\b(net interest income|pendapatan bunga bersih)\b/i, { field: 'net_interest_income', path: ['financials_sector_metrics', 'net_interest_income'], label: 'Pendapatan bunga bersih', basis: 'flow' }],
  [/\b(interest income|pendapatan bunga)\b/i, { field: 'interest_income', path: ['financials_sector_metrics', 'interest_income'], label: 'Pendapatan bunga', basis: 'flow' }],
  [/\b(interest expense|beban bunga|biaya bunga)\b/i, { field: 'interest_expense', path: ['financials_sector_metrics', 'interest_expense'], label: 'Beban bunga', basis: 'flow' }],
  [/\b(provisi|provision|pencadangan|biaya cadangan kredit)\b/i, { field: 'provision', path: ['provision'], label: 'Beban provisi', basis: 'flow' }],
  [/\b(ebitda)\b/i, { field: 'ebitda', path: ['ebitda'], label: 'EBITDA', basis: 'flow' }],
  [/\b(ebit)\b/i, { field: 'ebit', path: ['ebit'], label: 'EBIT', basis: 'flow' }],
  [/\b(laba operasional|laba operasi|operating profit)\b/i, { field: 'operating_pnl', path: ['operating_pnl'], label: 'Laba operasional', basis: 'flow' }],
  [/\b(laba sebelum pajak|earnings before tax|profit before tax)\b/i, { field: 'earnings_before_tax', path: ['earnings_before_tax'], label: 'Laba sebelum pajak', basis: 'flow' }],
  [/\b(laba kotor|gross profit)\b/i, { field: 'gross_profit', path: ['gross_profit'], label: 'Laba kotor', basis: 'flow' }],
  [/\b(total aset|total assets)\b/i, { field: 'total_assets', path: ['total_assets'], label: 'Total aset', basis: 'stock' }],
  [/\b(total ekuitas|total equity)\b/i, { field: 'total_equity', path: ['total_equity'], label: 'Total ekuitas', basis: 'stock' }],
  [/\b(total kredit|kredit bruto|gross loan)\b/i, { field: 'gross_loan', path: ['financials_sector_metrics', 'gross_loan'], label: 'Total kredit bruto', basis: 'stock' }],
  [/\b(total simpanan|total deposit|dana pihak ketiga|dpk)\b/i, { field: 'total_deposit', path: ['financials_sector_metrics', 'total_deposit'], label: 'Total simpanan', basis: 'stock' }],
  [/\b(nim|margin|eps|roa|roe|casa|npl|car|nasabah|portofolio)\b/i, null],
  [/\b(revenue|pendapatan|omset|omzet|penjualan|sales)\b/i, { field: 'revenue', path: ['revenue'], label: 'Pendapatan', basis: 'flow' }],
  [/\b(laba|earnings|profit)\b/i, { field: 'earnings', path: ['earnings'], label: 'Laba bersih', basis: 'flow' }],
];
export function resolveFinancialMetric(text: string): FinancialMetric | null {
  for (const [pattern, metric] of entries) if (pattern.test(text)) return metric;
  return null;
}
export function isNimMetric(text: string): boolean { return /\b(nim|net interest margin)\b/i.test(text); }
export function financialField(row: Record<string, unknown>, metric: FinancialMetric): number | null {
  let value: unknown = row;
  for (const key of metric.path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export type AnnualFinancialRatio = { field: string; group: string; label: string };
export function resolveAnnualFinancialRatio(metric: string): AnnualFinancialRatio | null {
  const ratios: Array<[RegExp, AnnualFinancialRatio]> = [
    [/\b(nim|net interest margin)\b/i, { field: 'net_interest_margin', group: 'profitability', label: 'NIM' }],
    [/\b(roa|return on assets?)\b/i, { field: 'roa', group: 'profitability', label: 'ROA' }],
    [/\b(roe|return on equity)\b/i, { field: 'roe', group: 'profitability', label: 'ROE' }],
    [/\b(casa)\b/i, { field: 'casa_ratio', group: 'liquidity', label: 'CASA' }],
    [/\b(car|capital adequacy ratio)\b/i, { field: 'capital_adequacy_ratio', group: 'capital', label: 'CAR' }],
    [/\b(net profit margin|margin laba bersih)\b/i, { field: 'net_profit_margin', group: 'profitability', label: 'Margin laba bersih' }],
    [/\b(operating profit margin|margin laba operasional)\b/i, { field: 'operating_profit_margin', group: 'profitability', label: 'Margin laba operasional' }],
  ];
  return ratios.find(([pattern]) => pattern.test(metric))?.[1] ?? null;
}
