import type { CheckSource, ClaimType, Verdict } from '@cek-dulu/shared/schemas';
import { cleanText } from '../../../packages/agent/src/clean-text';
import { formatEvidence, readableSourceText, readableToolName, verdictLabels, type HistoryItem } from './check-view';
import { comparisonFor, contextTitles, verdictSummaries } from './report-presentation';
import { renderBrandedReportPdf } from './report-pdf-renderer';

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
        source: `Sectors · ${readableToolName(record.tool)} · ${dateOnly(record.fetchedAt)}`,
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

export const renderReportPdf = renderBrandedReportPdf;

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
