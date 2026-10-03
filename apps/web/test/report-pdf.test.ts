import { describe, expect, it } from 'vitest';
import { checkFixtures } from '../../../packages/shared/fixtures/index.js';
import { formatEvidence, type HistoryItem } from '../lib/check-view';
import { buildReportDocument, pdfSafeText, renderReportPdf, reportFileName, REPORT_DISCLAIMER } from '../lib/report-pdf';

const itemFor = (fixture = checkFixtures[0]!, demo = false): HistoryItem => ({ id: fixture.result.checkId, text: fixture.input.rawText,
  createdAt: fixture.input.createdAt, demo, saved: false, source: fixture.input.source, result: fixture.result, traces: fixture.traces });

describe('isi rapor PDF', () => {
  it.each(checkFixtures)('setiap verdict $input.checkId menjadi satu bagian klaim', (fixture) => {
    const report = buildReportDocument(itemFor(fixture));
    expect(report.claims).toHaveLength(fixture.result.verdicts.length);
    expect(report.sourceText).toBe(fixture.input.rawText);
    expect(report.disclaimer).toBe(REPORT_DISCLAIMER);
    expect(report.notice).toBeUndefined();
  });

  it('angka bukti diambil dari Evidence lewat pemformat rapor, bukan dihitung ulang', () => {
    const fixture = checkFixtures[0]!;
    const report = buildReportDocument(itemFor(fixture));
    const verdict = fixture.result.verdicts[0]!;
    const records = fixture.result.evidence.filter(record => verdict.evidenceIds.includes(record.evidenceId));
    expect(report.claims[0]!.evidence.map(line => line.value)).toEqual(records.map(record => formatEvidence(record)));
    expect(report.claims[0]!.evidence[0]!.source).toContain(`Sectors ${records[0]!.tool}`);
  });

  it('kutipan klaim memakai span pada teks bersih', () => {
    const fixture = checkFixtures[0]!;
    const claim = fixture.result.claims[0]!;
    expect(fixture.input.rawText).toContain(buildReportDocument(itemFor(fixture)).claims[0]!.quote);
    expect(buildReportDocument(itemFor(fixture)).claims[0]!.heading).toContain(claim.ticker);
  });

  it('demo fixture diberi tanda angka contoh', () => {
    expect(buildReportDocument(itemFor(checkFixtures[0], true)).notice).toContain('Demo fixture');
  });

  it('ekstraksi gagal tetap menjelaskan alasannya tanpa bagian klaim', () => {
    const base = itemFor();
    const item: HistoryItem = { ...base, result: { ...base.result, claims: [], verdicts: [], evidence: [] },
      traces: [{ checkId: base.id, ts: base.createdAt, stage: 'error', message: 'Layanan LLM terlalu lama merespons.',
        data: { code: 'EXTRACTION_FAILED' }, credits: 0 }] };
    const report = buildReportDocument(item);
    expect(report.claims).toEqual([]);
    expect(report.overview).toContain('Layanan LLM terlalu lama merespons.');
  });

  it('tidak memuat kata rekomendasi beli atau jual', () => {
    for (const fixture of checkFixtures) {
      const report = buildReportDocument(itemFor(fixture));
      const prose = [report.overview, ...report.claims.flatMap(claim => [claim.verdictSummary, claim.comparisonNote])].join(' ');
      expect(prose).not.toMatch(/\b(beli|jual|rekomendasi)\b/i);
    }
  });
});

describe('berkas PDF', () => {
  it('nama berkas memuat ticker dan tanggal WIB', () => {
    const fixture = checkFixtures[0]!;
    const name = reportFileName(itemFor(fixture));
    expect(name).toMatch(/^cek-dulu-[A-Z-]+-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(name).toContain(fixture.result.claims[0]!.ticker);
  });

  it('teks dibersihkan untuk font standar PDF tanpa mengubah angka', () => {
    expect(pdfSafeText('Rp−349,5 miliar 📈 · 3×')).toBe('Rp-349,5 miliar  · 3×');
    expect(pdfSafeText('“kutipan” …')).toBe('“kutipan” ...');
  });

  it('renderer menghasilkan PDF yang sah', async () => {
    const blob = await renderReportPdf(buildReportDocument(itemFor()));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
