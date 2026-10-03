import type { CheckInput, CheckResult, TraceEvent } from '../src/schemas.js';

/** Contoh kontrak offline, bukan rekaman respons endpoint Sectors. */
export type CheckFixture = {
  provenance: string;
  input: CheckInput;
  result: CheckResult;
  traces: TraceEvent[];
};

const ts = '2026-09-23T00:00:00.000Z';
const adroText = 'ADRO yield 25,5% setahun';
const perText = 'BBCA PER cuma 3x';
const predictionText = 'BBRI bakal naik 80%';

export const adroDividendFixture: CheckFixture = {
  provenance: 'AGENTS.md bagian 6; fakta ADRO diverifikasi 23 Sep 2026, bukan cache API baru.',
  input: { checkId: 'demo-adro', source: 'paste', rawText: adroText, createdAt: ts },
  result: {
    checkId: 'demo-adro',
    entities: [{ surface: 'ADRO', ticker: 'ADRO', confidence: 1, method: 'explicit' }],
    claims: [{
      claimId: 'adro-c1', checkId: 'demo-adro', span: [0, adroText.length],
      type: 'dividend', ticker: 'ADRO',
      asserted: { metric: 'yield dividen', value: 25.5, unit: '%', window: 'setahun' },
      inScope: true,
    }],
    evidence: [
      { evidenceId: 'adro-avg', claimId: 'adro-c1', tool: 'fetchCompanyReport',
        params: { symbol: 'ADRO', sections: ['dividend'] }, credits: 0, cached: true,
        fetchedAt: ts, label: 'Angka Sectors dividend_yield_avg.avg_yield', value: 0.255, unit: '%' },
      { evidenceId: 'adro-own-avg', claimId: 'adro-c1', tool: 'fixture:agents-section-6',
        params: { source: 'AGENTS.md bagian 6', formula: 'sum(total_yield per tahun) / jumlah tahun', period: '2021–2025', approximate: true },
        credits: 0, cached: true, fetchedAt: ts,
        label: 'Rata-rata mandiri sekitar 23,6%; ringkasan AGENTS.md, bukan dihitung ulang dari data tahunan di fixture', value: 0.236, unit: '%' },
      { evidenceId: 'adro-payment', claimId: 'adro-c1', tool: 'fetchCompanyReport',
        params: { symbol: 'ADRO', sections: ['dividend'] }, credits: 0, cached: true,
        fetchedAt: ts, label: 'Pembayaran khusus 28 Nov 2024 terkait pemisahan AADI', value: 1358.18, unit: 'IDR' },
      { evidenceId: 'adro-payment-yield', claimId: 'adro-c1', tool: 'fetchCompanyReport',
        params: { symbol: 'ADRO', sections: ['dividend'] }, credits: 0, cached: true,
        fetchedAt: ts, label: 'Yield pembayaran khusus', value: 0.452, unit: '%' },
      { evidenceId: 'adro-ttm', claimId: 'adro-c1', tool: 'fetchCompanyReport',
        params: { symbol: 'ADRO', sections: ['dividend'] }, credits: 0, cached: true,
        fetchedAt: ts, label: 'Yield TTM', value: 0.0556, unit: '%' },
      { evidenceId: 'adro-cash', claimId: 'adro-c1', tool: 'fetchCompanyReport',
        params: { symbol: 'ADRO', sections: ['dividend'] }, credits: 0, cached: true,
        fetchedAt: ts, label: 'Cash payout ratio', value: -0.897, unit: 'x' },
    ],
    hypothesisRuns: [{ hypId: 'DIV_ONE_OFF', claimId: 'adro-c1', triggered: true,
      strength: 'strong', evidenceIds: ['adro-payment', 'adro-payment-yield'],
      note: 'Pembayaran khusus terkait pemisahan AADI tidak mewakili dividen rutin.' }],
    verdicts: [{ claimId: 'adro-c1', verdict: 'misleading',
      computed: { value: 0.255, unit: '%', evidenceId: 'adro-avg' },
      missingContext: [{ hypId: 'DIV_ONE_OFF', summary: 'Ada pembayaran khusus terkait pemisahan AADI.',
        evidenceIds: ['adro-payment', 'adro-payment-yield'] }],
      explanation: 'Angka Sectors 25,5% bukan jaminan yield tahunan berulang. Rata-rata mandiri sekitar 23,6% memakai rumus jumlah yield tahunan dibagi jumlah tahun. Ada pembayaran khusus Rp1.358,18 dengan yield 45,2% terkait pemisahan AADI. Data dividen terbaru perlu dikonfirmasi sebelum menilai selisih TTM.',
      evidenceIds: ['adro-avg', 'adro-own-avg', 'adro-payment', 'adro-payment-yield', 'adro-ttm', 'adro-cash'] }],
    creditsUsed: 0, finishedAt: ts,
  },
  traces: [
    { checkId: 'demo-adro', ts, stage: 'normalize', message: 'Kode ADRO dikenali.' },
    { checkId: 'demo-adro', ts, stage: 'extract', message: 'Klaim yield dividen ditemukan.' },
    { checkId: 'demo-adro', ts, stage: 'route', message: 'Memakai contoh data dividen offline.' },
    { checkId: 'demo-adro', ts, stage: 'verify', message: 'Angka klaim cocok dengan angka Sectors.', credits: 0 },
    { checkId: 'demo-adro', ts, stage: 'hunt', message: 'Konteks pembayaran khusus ditemukan.' },
    { checkId: 'demo-adro', ts, stage: 'adjudicate', message: 'Klaim benar tetapi menyesatkan.' },
    { checkId: 'demo-adro', ts, stage: 'done', message: 'Contoh cek selesai.', credits: 0 },
  ],
};

export const supportedPerFixture: CheckFixture = {
  provenance: 'DATA SINTETIS untuk validasi kontrak; PER ini bukan data aktual BBCA.',
  input: { checkId: 'demo-per', source: 'screenshot', rawText: perText, createdAt: ts },
  result: {
    checkId: 'demo-per',
    entities: [{ surface: 'BBCA', ticker: 'BBCA', confidence: 1, method: 'explicit' }],
    claims: [{ claimId: 'per-c1', checkId: 'demo-per', span: [0, perText.length],
      type: 'valuation', ticker: 'BBCA', asserted: { metric: 'PER', value: 3, unit: 'x' }, inScope: true }],
    evidence: [{ evidenceId: 'per-value', claimId: 'per-c1', tool: 'fixture:synthetic',
      params: { synthetic: true }, credits: 0, cached: true, fetchedAt: ts,
      label: 'PER sintetis untuk pengujian', value: 3, unit: 'x' }],
    hypothesisRuns: [{ hypId: 'VAL_PEER_GAP', claimId: 'per-c1', triggered: false,
      strength: 'weak', evidenceIds: [], note: 'Skenario sintetis menetapkan tidak ada konteks terpicu; bukan kesimpulan tentang peer aktual.' }],
    verdicts: [{ claimId: 'per-c1', verdict: 'supported', computed: { value: 3, unit: 'x', evidenceId: 'per-value' },
      missingContext: [], explanation: 'Dalam contoh sintetis ini, angka PER 3x sesuai dengan evidence. Status hanya menilai angka PER, bukan pendapat bahwa saham murah.',
      evidenceIds: ['per-value'] }],
    creditsUsed: 0, finishedAt: ts,
  },
  traces: [
    { checkId: 'demo-per', ts, stage: 'normalize', message: 'Kode BBCA dikenali.' },
    { checkId: 'demo-per', ts, stage: 'extract', message: 'Klaim angka PER ditemukan.' },
    { checkId: 'demo-per', ts, stage: 'route', message: 'Memakai evidence sintetis.' },
    { checkId: 'demo-per', ts, stage: 'verify', message: 'Angka cocok.', credits: 0 },
    { checkId: 'demo-per', ts, stage: 'hunt', message: 'Tidak ada konteks terpicu dalam skenario.' },
    { checkId: 'demo-per', ts, stage: 'adjudicate', message: 'Angka klaim didukung.' },
    { checkId: 'demo-per', ts, stage: 'done', message: 'Contoh cek selesai.', credits: 0 },
  ],
};

export const pricePredictionFixture: CheckFixture = {
  provenance: 'Input prediksi sintetis; tidak memanggil API dan tidak membuat evidence.',
  input: { checkId: 'demo-prediction', source: 'paste', rawText: predictionText, createdAt: ts },
  result: {
    checkId: 'demo-prediction',
    entities: [{ surface: 'BBRI', ticker: 'BBRI', confidence: 1, method: 'explicit' }],
    claims: [{ claimId: 'prediction-c1', checkId: 'demo-prediction', span: [0, predictionText.length],
      type: 'price_move', ticker: 'BBRI', asserted: { metric: 'perubahan harga', value: 80, unit: '%' }, inScope: false }],
    evidence: [], hypothesisRuns: [],
    verdicts: [{ claimId: 'prediction-c1', verdict: 'out_of_scope', missingContext: [],
      explanation: 'Kalimat ini merupakan prediksi harga masa depan, sehingga berada di luar cakupan pemeriksaan data historis.', evidenceIds: [] }],
    creditsUsed: 0, finishedAt: ts,
  },
  traces: [
    { checkId: 'demo-prediction', ts, stage: 'normalize', message: 'Kode BBRI dikenali.' },
    { checkId: 'demo-prediction', ts, stage: 'extract', message: 'Prediksi ditemukan.' },
    { checkId: 'demo-prediction', ts, stage: 'adjudicate', message: 'Prediksi berada di luar cakupan.' },
    { checkId: 'demo-prediction', ts, stage: 'done', message: 'Contoh cek selesai tanpa panggilan data.', credits: 0 },
  ],
};

export const checkFixtures = [adroDividendFixture, supportedPerFixture, pricePredictionFixture];
