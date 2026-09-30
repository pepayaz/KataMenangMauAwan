import { describe, expect, it } from 'vitest';
import { HypothesisResultSchema, EvidenceSchema } from '@cek-dulu/shared';
import { adjudicate } from '../src/adjudicator.js';
import { flattenHunterToolResult, median, testDivOneOff, testDivTtmGap, testDivCashPayout,
  testValPeerGap, testValOwnHistory, testValNegPeg, testPrcLowBase, testPrcThinLiq, testPrcWindow, createHypothesisRegistry } from '../src/hunter/index.js';
import { actionsEvidence, adroKnownEvidence, context, dividendEvidence, makeClaim, priceData, priceEvidence,
  today, toolResult, valuationEvidence } from './fixtures/hunter.js';

describe('hipotesis dividen', () => {
  const claim = makeClaim('dividend');
  it('DIV_ONE_OFF terpicu oleh pembayaran dominan: ADRO dengan total periode sintetis', () => {
    const result = testDivOneOff(claim, dividendEvidence(), context);
    expect(result).toMatchObject({ triggered: true, strength: 'strong' });
    expect(result.evidenceIds.length).toBeGreaterThanOrEqual(2);
  });
  it('DIV_ONE_OFF tidak terpicu bila pembayaran merata/tepat 60%', () => {
    const evidence = dividendEvidence({ historical_dividends: { '2024': { total_dividend: 1000,
      breakdown: [{ date: '2024-01-01', total: 600 }, { date: '2024-07-01', total: 400 }] } } });
    expect(testDivOneOff(claim, evidence, context).triggered).toBe(false);
  });
  it('DIV_ONE_OFF satu pembayaran rutin tidak menjadi strong', () => {
    const evidence = dividendEvidence({ historical_dividends: { '2024': { total_dividend: 1000,
      breakdown: [{ date: '2024-01-01', total: 1000 }] } } });
    expect(testDivOneOff(claim, evidence, context)).toMatchObject({ triggered: true, strength: 'weak' });
  });
  it('DIV_ONE_OFF total null/lebih kecil dari pembayaran tidak ditebak', () => {
    expect(testDivOneOff(claim, dividendEvidence({ historical_dividends: { '2024': { total_dividend: null,
      breakdown: [{ date: '2024-01-01', total: 1358.18 }] } } }), context).triggered).toBe(false);
    expect(testDivOneOff(claim, dividendEvidence({ historical_dividends: { '2024': { total_dividend: 100,
      breakdown: [{ date: '2024-01-01', total: 1358.18 }] } } }), context).triggered).toBe(false);
  });
  it('DIV_ONE_OFF membatasi tahun eksplisit', () => {
    expect(testDivOneOff({ ...claim, asserted: { ...claim.asserted, period: '2025' } }, dividendEvidence(), context).triggered).toBe(false);
  });
  it('DIV_TTM_GAP ADRO hanya weak saat data tahun berjalan belum tersedia', () => {
    const result = testDivTtmGap(claim, adroKnownEvidence, context);
    expect(result).toMatchObject({ triggered: true, strength: 'weak' });
    expect(result.note).toContain('data tahun ini belum tersedia');
    expect(adjudicate(claim, { evidence: adroKnownEvidence, matches: true, tolerance: '10%' }, [result]).verdict).toBe('supported');
  });
  it('DIV_TTM_GAP strong hanya bila coverage dan corporate-actions telah diperiksa', () => {
    const evidence = dividendEvidence({ historical_dividends: { '2026': { total_dividend: 100, breakdown: [] } } });
    expect(testDivTtmGap(claim, [...evidence, ...actionsEvidence(true)], context)).toMatchObject({ triggered: true, strength: 'strong' });
  });
  it('DIV_TTM_GAP report kosong tetapi corporate-actions ada tidak dianggap TTM lengkap', () => {
    expect(testDivTtmGap(claim, [...dividendEvidence(), ...actionsEvidence(true)], context)).toMatchObject({ triggered: true, strength: 'weak' });
  });
  it('DIV_TTM_GAP tidak terpicu saat TTM dekat avg atau angka klaim mengacu TTM', () => {
    expect(testDivTtmGap(claim, [...dividendEvidence({ yield_ttm: 0.2 }), ...actionsEvidence(true)], context).triggered).toBe(false);
    expect(testDivTtmGap(makeClaim('dividend', { value: 5.56, metric: 'yield TTM' }), dividendEvidence(), context).triggered).toBe(false);
    expect(testDivTtmGap(makeClaim('dividend', { period: '2024' }), dividendEvidence(), context).triggered).toBe(false);
  });
  it('DIV_TTM_GAP coverage report tersedia, actions unknown tetap weak', () => {
    const evidence = dividendEvidence({ historical_dividends: { '2026': { total_dividend: 100, breakdown: [] } } });
    expect(testDivTtmGap(claim, evidence, context)).toMatchObject({ triggered: true, strength: 'weak' });
  });
  it.each([-0.897, 1.01, 0, 1, 0.5])('DIV_CASH_PAYOUT %s', (ratio) => {
    expect(testDivCashPayout(claim, dividendEvidence({ cash_payout_ratio: ratio })).triggered).toBe(ratio < 0 || ratio > 1);
  });
  it('DIV_CASH_PAYOUT fakta ADRO terpicu strong', () => {
    expect(testDivCashPayout(claim, adroKnownEvidence)).toMatchObject({ triggered: true, strength: 'strong' });
  });
});

describe('hipotesis valuasi', () => {
  const claim = makeClaim('valuation');
  it('median ganjil/genap, tanpa mengubah array input', () => {
    const values = [100, 3, 2];
    expect(median(values)).toBe(3); expect(values).toEqual([100, 3, 2]);
    expect(median([1, 3])).toBe(2); expect(median([])).toBeNull();
  });
  it('VAL_PEER_GAP menggunakan median setelah negatif/nol/outlier dibuang', () => {
    const evidence = valuationEvidence();
    const result = testValPeerGap(claim, evidence, context);
    expect(result).toMatchObject({ triggered: true, strength: 'strong' });
    const included = evidence.filter((e) => result.evidenceIds.includes(e.evidenceId));
    expect(included.filter((e) => e.params.hunter && e.label.startsWith('peer.pe')).map((e) => e.value)).toEqual([3, 4, 5]);
  });
  it('VAL_PEER_GAP tidak terpicu tanpa premium dan tidak memakai peer_avg', () => {
    expect(testValPeerGap(claim, valuationEvidence(4), context).triggered).toBe(false);
    expect(testValPeerGap(claim, valuationEvidence(6, [], [3, 4]), context).triggered).toBe(false);
  });
  it('VAL_PEER_GAP tidak memakai PE untuk klaim PB dan tidak menghitung diri sebagai peer', () => {
    expect(testValPeerGap(makeClaim('valuation', { metric: 'PBV' }), valuationEvidence(), context).triggered).toBe(false);
    const evidence = valuationEvidence(6, [], [3, 4, 5]).map((e) => e.label.startsWith('peer.pe P2')
      ? { ...e, params: { ...e.params, hunter: { ...(e.params.hunter as object), peer: 'ADRO' } } } : e);
    expect(testValPeerGap(claim, evidence, context).triggered).toBe(false);
  });
  it('VAL_OWN_HISTORY terpicu bila premium terhadap median sendiri', () => {
    expect(testValOwnHistory(makeClaim('valuation', { value: 4 }), valuationEvidence(4), context)).toMatchObject({ triggered: true, strength: 'strong' });
  });
  it('VAL_OWN_HISTORY tidak terpicu bila valuasi dekat median', () => {
    expect(testValOwnHistory(makeClaim('valuation', { value: 3 }), valuationEvidence(3), context).triggered).toBe(false);
  });
  it('VAL_OWN_HISTORY menemukan angka klaim dari tahun lama', () => {
    expect(testValOwnHistory(makeClaim('valuation', { value: 2 }), valuationEvidence(6, [2, 3, 4]), context)).toMatchObject({ triggered: true, strength: 'strong' });
  });
  it('VAL_OWN_HISTORY tidak menghukum periode lampau yang disebut eksplisit', () => {
    expect(testValOwnHistory(makeClaim('valuation', { value: 2, period: '2025' }), valuationEvidence(6, [2, 3, 4]), context).triggered).toBe(false);
  });
  it.each([-1, 0, 1, null])('VAL_NEG_PEG %s', (peg) => {
    expect(testValNegPeg(claim, valuationEvidence(6, [], [], peg), context).triggered).toBe(peg !== null && peg < 0);
  });
  it('nilai terbaru null tidak diisi PEG negatif dari tahun lama', () => {
    const evidence = flattenHunterToolResult(claim, toolResult({ symbol: 'ADRO', valuation: { historical_valuation: [
      { year: 2026, pe: null, peg: null }, { year: 2025, pe: 6, peg: -1 }] } }, 'fetchCompanyReport', ['valuation']), today);
    expect(testValNegPeg(claim, evidence, context).triggered).toBe(false);
    expect(testValPeerGap(claim, evidence, context).triggered).toBe(false);
  });
});

describe('hipotesis harga', () => {
  const claim = makeClaim('price_move');
  it('PRC_LOW_BASE terpicu rebound dari separuh median historis', () => {
    expect(testPrcLowBase(claim, priceEvidence(), context)).toMatchObject({ triggered: true, strength: 'strong' });
  });
  it('PRC_LOW_BASE tidak terpicu dari basis normal/kurang data', () => {
    expect(testPrcLowBase(claim, priceEvidence(false), context).triggered).toBe(false);
    expect(testPrcLowBase(claim, [], context).triggered).toBe(false);
  });
  it('PRC_THIN_LIQ terpicu/tidak berdasarkan volume x harga', () => {
    expect(testPrcThinLiq(claim, priceEvidence(), context)).toMatchObject({ triggered: true, strength: 'strong' });
    expect(testPrcThinLiq(claim, priceEvidence(false, 100_000_000), context).triggered).toBe(false);
  });
  it('PRC_THIN_LIQ menghitung pasangan per tanggal, bukan perkalian dua rata-rata', () => {
    const data = priceData(false).slice(-5).map((r, i) => ({ ...r, close: i % 2 ? 10000 : 1, volume: i % 2 ? 1 : 1_000_000_000 }));
    const evidence = flattenHunterToolResult(claim, toolResult(data, 'fetchDailyPrice'), today);
    expect(testPrcThinLiq(claim, evidence, context).triggered).toBe(true);
  });
  it('PRC_THIN_LIQ null atau seluruh volume nol tidak dianggap likuiditas terukur', () => {
    expect(testPrcThinLiq(claim, priceEvidence(false, 0), context).triggered).toBe(false);
    const data = priceData(false).map((r) => ({ ...r, volume: null }));
    expect(testPrcThinLiq(claim, flattenHunterToolResult(claim, toolResult(data, 'fetchDailyPrice'), today), context).triggered).toBe(false);
  });
  it('PRC_WINDOW terpicu ketika rebound pendek berbeda dari jendela panjang', () => {
    expect(testPrcWindow(claim, priceEvidence(), context)).toMatchObject({ triggered: true, strength: 'strong' });
  });
  it('PRC_WINDOW tidak terpicu untuk harga stabil atau jendela sama', () => {
    expect(testPrcWindow(claim, priceEvidence(false), context).triggered).toBe(false);
    expect(testPrcWindow(claim, priceEvidence(), { ...context, comparisonWindow: context.priceWindow }).triggered).toBe(false);
  });
});

describe('integritas evidence', () => {
  it('semua fixture dan hasil sesuai kontrak Zod', () => {
    for (const evidence of [dividendEvidence(), valuationEvidence(), priceEvidence(), adroKnownEvidence]) {
      expect(evidence.every((e) => EvidenceSchema.safeParse(e).success)).toBe(true);
    }
    expect(HypothesisResultSchema.safeParse(testDivCashPayout(makeClaim('dividend'), adroKnownEvidence)).success).toBe(true);
  });
  it('evidence klaim/ticker lain diabaikan, input tidak dimutasi', () => {
    const evidence = dividendEvidence(), before = structuredClone(evidence);
    expect(testDivCashPayout({ ...makeClaim('dividend'), claimId: 'other' }, evidence).triggered).toBe(false);
    expect(testDivCashPayout({ ...makeClaim('dividend'), ticker: 'BBRI' }, evidence).triggered).toBe(false);
    testDivOneOff(makeClaim('dividend'), evidence, context);
    expect(evidence).toEqual(before);
  });
  it('satuan keliru tidak ditafsirkan sebagai rasio kas', () => {
    const evidence = adroKnownEvidence.map((e) => ({ ...e, unit: 'IDR' }));
    expect(testDivCashPayout(makeClaim('dividend'), evidence).triggered).toBe(false);
  });
  it('adapter menolak simbol/tanggal invalid dan menghapus duplikasi identik', () => {
    expect(() => flattenHunterToolResult(makeClaim('dividend'), toolResult({ symbol: 'BBRI' }), today)).toThrow('simbol');
    expect(() => flattenHunterToolResult(makeClaim('price_move'), toolResult([
      { symbol: 'ADRO', date: '2026-02-30', close: 100, volume: 1 }], 'fetchDailyPrice'), today)).toThrow();
    const data = priceData().slice(-1);
    expect(flattenHunterToolResult(makeClaim('price_move'), toolResult([...data, ...data], 'fetchDailyPrice'), today)).toHaveLength(2);
  });
});

describe('registry dividen hanya untuk klaim yield', () => {
  it('klaim nominal per saham tidak mendapat hipotesis dividen', () => {
    const amount = makeClaim('dividend', { metric: 'dividen interim per saham', value: 87, unit: 'IDR' });
    expect([...createHypothesisRegistry(amount, { today }).keys()]).toEqual([]);
    expect([...createHypothesisRegistry(makeClaim('dividend'), { today }).keys()]).toContain('DIV_ONE_OFF');
  });
});
