import type { CheckSource, ClaimType, Verdict } from '@cek-dulu/shared/schemas';
import { cleanText } from '../../../packages/agent/src/clean-text';
import { formatEvidence, readableSourceText, verdictLabels, type HistoryItem } from './check-view';
import { comparisonFor, contextTitles, verdictSummaries } from './report-presentation';

/**
 * Rapor PDF dari hasil pemeriksaan.
 *
 * Penyusun isi (`buildReportDocument`) murni dan diuji terpisah dari renderer.
 * Setiap angka di PDF berasal dari teks klaim atau objek Evidence, lewat
 * pemformat yang sama dengan rapor di layar; tidak ada perhitungan baru di sini.
 */

const typeLabels: Record<ClaimType, string> = { dividend: 'Dividen', valuation: 'Valuasi', price_move: 'Perubahan harga',
  earnings_growth: 'Pertumbuhan laba', foreign_flow: 'Arus asing', accumulation: 'Akumulasi', safety: 'Risiko' };
const sourceLabels: Record<CheckSource, string> = { paste: 'Teks tempel', share_target: 'Dibagikan dari aplikasi',
  screenshot: 'Screenshot', extension: 'Ekstensi X' };

export const REPORT_DISCLAIMER = 'Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi. Status klaim menilai '
  + 'kesesuaian klaim dengan data yang tersedia, bukan kelayakan membeli atau menjual saham. Data bersumber dari Sectors '
  + 'dan dapat tertinggal dari kondisi terkini. Lakukan riset sendiri sebelum mengambil keputusan.';

export type ReportEvidenceLine = { label: string; value: string; source: string };
export type ReportClaimSection = {
  heading: string;
  verdict: Verdict;
  verdictLabel: string;
  verdictSummary: string;
  quote: string;
  claimed: string;
  compared: string;
  comparisonNote: string;
  contexts: { title: string; summary: string }[];
  explanation: string;
  evidence: ReportEvidenceLine[];
};
export type ReportDocument = {
  title: string;
  meta: [string, string][];
  sourceText: string;
  notice?: string;
  overview: string;
  claims: ReportClaimSection[];
  disclaimer: string;
};

const dateTime = (iso: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' })
  .format(new Date(iso)) + ' WIB';
const dateOnly = (iso: string) => {
  const parsed = new Date(iso);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(parsed) : iso;
};

export function buildReportDocument(item: HistoryItem): ReportDocument {
  const result = item.result;
  const tickers = [...new Set(result.claims.map(claim => claim.ticker))];
  const normalizedText = cleanText(item.text);
  const failure = item.traces.find(trace => trace.stage === 'error'
    && (trace.data as { code?: unknown } | undefined)?.code === 'EXTRACTION_FAILED');

  const meta: [string, string][] = [
    ['Waktu pemeriksaan', dateTime(item.createdAt)],
    ['Saham', tickers.join(', ') || '-'],
    ['Sumber input', sourceLabels[item.source ?? 'paste']],
    ...(item.url ? [['Tautan', item.url] as [string, string]] : []),
    ['ID pemeriksaan', item.id],
  ];

  const counts = new Map<Verdict, number>();
  for (const verdict of result.verdicts) counts.set(verdict.verdict, (counts.get(verdict.verdict) ?? 0) + 1);
  const overview = result.verdicts.length
    ? `${result.verdicts.length} klaim diperiksa: ${[...counts].map(([verdict, count]) => `${count} ${verdictLabels[verdict].toLowerCase()}`).join(', ')}.`
    : failure ? `Klaim belum dapat diperiksa. ${failure.message}` : 'Belum ada klaim yang bisa diperiksa.';

  const claims = result.verdicts.map((verdict): ReportClaimSection => {
    const claim = result.claims.find(candidate => candidate.claimId === verdict.claimId);
    const evidence = result.evidence.filter(record => verdict.evidenceIds.includes(record.evidenceId));
    const comparison = comparisonFor(claim, verdict);
    const period = claim?.asserted.period ? ` (${claim.asserted.period})` : '';
    const computed = verdict.computed && evidence.find(record => record.evidenceId === verdict.computed?.evidenceId);
    return {
      heading: claim ? `${claim.ticker} · ${typeLabels[claim.type]}` : 'Klaim',
      verdict: verdict.verdict,
      verdictLabel: verdictLabels[verdict.verdict],
      verdictSummary: verdictSummaries[verdict.verdict],
      quote: (claim ? normalizedText.slice(claim.span[0], claim.span[1]) : '') || item.text,
      claimed: `${comparison.left}${period}`,
      compared: comparison.right,
      comparisonNote: computed ? readableSourceText(computed.label)
        : verdict.verdict === 'out_of_scope' ? 'Prediksi tidak memiliki angka pembanding historis.' : 'Belum ada data angka yang memadai.',
      contexts: verdict.missingContext.map(context => ({ title: contextTitles[context.hypId] ?? 'Konteks tambahan', summary: context.summary })),
      explanation: verdict.explanation,
      evidence: evidence.map(record => ({
        label: readableSourceText(record.label).replace(/[.\s]+$/, ''),
        value: formatEvidence(record),
        source: `Sectors ${record.tool} · ${record.cached ? 'cache' : 'langsung'} · ${dateOnly(record.fetchedAt)}`,
      })),
    };
  });

  return {
    title: 'Rapor Pemeriksaan Klaim',
    meta,
    sourceText: item.text,
    ...(item.demo ? { notice: 'Demo fixture offline: angka contoh, bukan data pasar terkini.' } : {}),
    overview,
    claims,
    disclaimer: REPORT_DISCLAIMER,
  };
}

/** Nama berkas aman lintas sistem: cek-dulu-BBCA-2026-10-03.pdf. */
export function reportFileName(item: HistoryItem): string {
  const tickers = [...new Set(item.result.claims.map(claim => claim.ticker))].slice(0, 3).join('-');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(item.createdAt));
  return `cek-dulu-${tickers ? `${tickers}-` : ''}${date}.pdf`.replace(/[^A-Za-z0-9.-]/g, '');
}

/**
 * Font standar PDF hanya mengenal WinAnsi. Karakter di luar itu (emoji, minus
 * Unicode, aksara lain) diganti agar tidak tercetak sebagai simbol rusak.
 */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
export function pdfSafeText(text: string): string {
  return text.normalize('NFKC')
    .replace(/[−‐‑]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[^\n\t\x20-\x7E\xA0-\xFF]/gu, char => WIN_ANSI_EXTRA.has(char) ? char : '');
}

const verdictColors: Record<Verdict, [number, number, number]> = {
  supported: [22, 128, 61], refuted: [190, 18, 60], misleading: [180, 106, 0], unverifiable: [100, 116, 139], out_of_scope: [100, 116, 139],
};

/** Menggambar ReportDocument ke PDF A4. jsPDF dimuat hanya saat tombol unduh dipakai. */
export async function renderReportPdf(report: ReportDocument): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18, bottom = 18, width = pageWidth - margin * 2;
  let y = margin;

  const ensure = (height: number) => {
    if (y + height <= pageHeight - bottom) return;
    pdf.addPage(); y = margin;
  };
  const write = (text: string, options: { size?: number; style?: 'normal' | 'bold' | 'italic'; color?: [number, number, number];
    indent?: number; after?: number } = {}) => {
    const size = options.size ?? 10, indent = options.indent ?? 0;
    const lineHeight = size * 0.3528 * 1.4;
    pdf.setFont('helvetica', options.style ?? 'normal').setFontSize(size).setTextColor(...(options.color ?? [30, 41, 59]));
    for (const line of pdf.splitTextToSize(pdfSafeText(text), width - indent) as string[]) {
      ensure(lineHeight);
      pdf.text(line, margin + indent, y + size * 0.3528);
      y += lineHeight;
    }
    y += options.after ?? 1.5;
  };
  const rule = (gap = 4) => {
    ensure(gap * 2);
    y += gap; pdf.setDrawColor(203, 213, 225).setLineWidth(0.2).line(margin, y, pageWidth - margin, y); y += gap;
  };
  const muted: [number, number, number] = [100, 116, 139];

  write('CEK DULU', { size: 9, style: 'bold', color: [37, 99, 235], after: 0.5 });
  write(report.title, { size: 18, style: 'bold', after: 3 });
  for (const [key, value] of report.meta) write(`${key}: ${value}`, { size: 9, color: muted, after: 0.3 });
  if (report.notice) { y += 2; write(report.notice, { size: 9, style: 'bold', color: verdictColors.misleading }); }
  rule();

  write('Teks yang diperiksa', { size: 11, style: 'bold' });
  write(report.sourceText, { size: 9, style: 'italic', color: [51, 65, 85], after: 3 });
  write('Ringkasan', { size: 11, style: 'bold' });
  write(report.overview, { size: 10 });

  report.claims.forEach((claim, index) => {
    rule(5);
    ensure(30);
    const top = y, color = verdictColors[claim.verdict];
    write(`Klaim ${index + 1} · ${claim.heading}`, { size: 12, style: 'bold', indent: 4, after: 0.5 });
    write(claim.verdictLabel.toUpperCase(), { size: 9, style: 'bold', color, indent: 4, after: 0.5 });
    write(claim.verdictSummary, { size: 9, color: muted, indent: 4 });
    pdf.setFillColor(...color).rect(margin, top, 1.4, y - top, 'F');
    y += 1;
    write(`"${claim.quote}"`, { size: 10, style: 'italic', after: 2.5 });
    write(`Diklaim: ${claim.claimed}`, { size: 10, style: 'bold', after: 0.5 });
    write(`Hasil pembanding: ${claim.compared}`, { size: 10, style: 'bold', after: 0.5 });
    write(claim.comparisonNote, { size: 9, color: muted, after: 2.5 });
    if (claim.contexts.length) {
      write('Konteks yang perlu diketahui', { size: 10, style: 'bold', after: 1 });
      for (const context of claim.contexts) {
        write(`• ${context.title}`, { size: 9.5, style: 'bold', indent: 2, after: 0.3 });
        write(context.summary, { size: 9.5, indent: 5, after: 1.5 });
      }
    }
    if (claim.explanation) {
      write('Penjelasan', { size: 10, style: 'bold', after: 1 });
      write(claim.explanation, { size: 9.5, after: 2.5 });
    }
    if (claim.evidence.length) {
      write(`Bukti data (${claim.evidence.length})`, { size: 10, style: 'bold', after: 1 });
      for (const line of claim.evidence) {
        write(`${line.label}: ${line.value}`, { size: 9, indent: 2, after: 0.2 });
        write(line.source, { size: 7.5, color: muted, indent: 2, after: 1.2 });
      }
    }
  });

  rule(5);
  write(report.disclaimer, { size: 8, color: muted });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page).setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...muted);
    pdf.text('Cek Dulu · bukan nasihat investasi', margin, pageHeight - 9);
    pdf.text(`Halaman ${page} dari ${pages}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
  }
  return pdf.output('blob');
}

/** Menyusun, menggambar, dan memicu unduhan di peramban. */
export async function downloadReportPdf(item: HistoryItem): Promise<void> {
  const blob = await renderReportPdf(buildReportDocument(item));
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url; link.download = reportFileName(item);
    document.body.append(link); link.click(); link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
