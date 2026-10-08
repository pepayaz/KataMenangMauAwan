import type { jsPDF } from 'jspdf';
import type { Verdict } from '@cek-dulu/shared/schemas';
import type { ReportClaimSection, ReportDocument } from './report-pdf';
import { pdfSafeText } from './report-pdf';

type Pdf = jsPDF;
type Rgb = [number, number, number];
type Fonts = { ui: string; display: string };

const C = {
  canvas: [5, 9, 16] as Rgb,
  panel: [10, 17, 29] as Rgb,
  raised: [14, 24, 39] as Rgb,
  line: [48, 68, 91] as Rgb,
  text: [238, 244, 249] as Rgb,
  muted: [190, 204, 218] as Rgb,
  subtle: [148, 168, 190] as Rgb,
  cyan: [55, 215, 255] as Rgb,
  blue: [91, 120, 255] as Rgb,
};

const verdictColors: Record<Verdict, Rgb> = {
  supported: [184, 255, 92],
  refuted: [255, 95, 109],
  misleading: [255, 181, 71],
  unverifiable: [169, 139, 255],
  out_of_scope: [112, 132, 157],
};

function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

/** Produksi memakai font lokal aplikasi; test Node tetap deterministik dengan Helvetica. */
async function installFonts(pdf: Pdf): Promise<Fonts> {
  const fallback = { ui: 'helvetica', display: 'helvetica' };
  if (typeof window === 'undefined' || (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent))) return fallback;
  try {
    const [uiResponse, displayResponse] = await Promise.all([
      fetch(new URL('../public/fonts/source-sans-3.ttf', import.meta.url).href),
      fetch(new URL('../public/fonts/barlow-semi-condensed-600.ttf', import.meta.url).href),
    ]);
    if (!uiResponse.ok || !displayResponse.ok) return fallback;
    const [ui, display] = await Promise.all([uiResponse.arrayBuffer(), displayResponse.arrayBuffer()]);
    pdf.addFileToVFS('source-sans-3.ttf', base64(ui));
    pdf.addFont('source-sans-3.ttf', 'SourceSans3', 'normal');
    pdf.addFont('source-sans-3.ttf', 'SourceSans3', 'bold');
    pdf.addFileToVFS('barlow-semi-condensed-600.ttf', base64(display));
    pdf.addFont('barlow-semi-condensed-600.ttf', 'BarlowSemiCondensed', 'normal');
    return { ui: 'SourceSans3', display: 'BarlowSemiCondensed' };
  } catch {
    return fallback;
  }
}

function brandMark(pdf: Pdf, x: number, y: number, size: number): void {
  pdf.setFillColor(169, 237, 248).setDrawColor(202, 248, 255).setLineWidth(0.35);
  pdf.roundedRect(x, y, size, size, size * 0.24, size * 0.24, 'FD');
  // Bentuk persis ikon Lucide CheckCheck yang dipakai wordmark website (viewBox 24x24).
  const sx = (value: number) => x + (value / 24) * size;
  const sy = (value: number) => y + (value / 24) * size;
  pdf.setDrawColor(7, 16, 24).setLineWidth((2.6 / 24) * size).setLineCap('round').setLineJoin('round');
  pdf.line(sx(18), sy(6), sx(7), sy(17));
  pdf.line(sx(7), sy(17), sx(2), sy(12));
  pdf.line(sx(22), sy(10), sx(14.5), sy(17.5));
  pdf.line(sx(14.5), sy(17.5), sx(13), sy(16));
}

export async function renderBrandedReportPdf(report: ReportDocument): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const fonts = await installFonts(pdf);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const width = pageWidth - margin * 2;
  const contentTop = 31;
  const contentBottom = pageHeight - 25;
  const meta = new Map(report.meta);
  const checkId = meta.get('ID pemeriksaan') ?? '-';
  const shortId = checkId.slice(0, 8).toUpperCase();
  let y = contentTop;

  pdf.setProperties({ title: report.title, subject: report.overview, author: 'Cek Dulu', creator: 'Cek Dulu' });

  function font(kind: 'ui' | 'display', bold = false): void {
    const family = kind === 'display' ? fonts.display : fonts.ui;
    const style = family === 'helvetica' && bold ? 'bold' : bold && kind === 'ui' ? 'bold' : 'normal';
    pdf.setFont(family, style);
  }
  function background(): void {
    pdf.setFillColor(...C.canvas).rect(0, 0, pageWidth, pageHeight, 'F');
  }
  function fixed(text: string, x: number, top: number, options: { size?: number; kind?: 'ui' | 'display'; bold?: boolean;
    color?: Rgb; align?: 'left' | 'right' | 'center' } = {}): void {
    font(options.kind ?? 'ui', options.bold);
    pdf.setFontSize(options.size ?? 9).setTextColor(...(options.color ?? C.text));
    pdf.text(pdfSafeText(text), x, top, { align: options.align ?? 'left' });
  }
  function wordmark(x: number, top: number, compact = false): void {
    const mark = compact ? 8 : 11;
    brandMark(pdf, x, top, mark);
    font('display');
    const size = compact ? 13 : 18;
    pdf.setFontSize(size).setTextColor(...C.text).text('cek', x + mark + 3, top + mark * 0.7);
    const cekWidth = pdf.getTextWidth('cek');
    pdf.setTextColor(...C.muted).text('dulu', x + mark + 3 + cekWidth, top + mark * 0.7);
    const duluWidth = pdf.getTextWidth('dulu');
    pdf.setTextColor(...C.cyan).text('.', x + mark + 3 + cekWidth + duluWidth, top + mark * 0.7);
  }
  function newPage(): void {
    pdf.addPage();
    background();
    y = contentTop;
  }
  function ensure(height: number): void {
    if (y + height > contentBottom) newPage();
  }
  function split(text: string, size: number, maxWidth = width): string[] {
    pdf.setFontSize(size);
    return pdf.splitTextToSize(pdfSafeText(text), maxWidth) as string[];
  }
  function write(text: string, options: { size?: number; kind?: 'ui' | 'display'; bold?: boolean; color?: Rgb;
    x?: number; maxWidth?: number; lineHeight?: number; after?: number } = {}): void {
    const size = options.size ?? 10;
    const x = options.x ?? margin;
    const lineHeight = options.lineHeight ?? size * 0.3528 * 1.38;
    font(options.kind ?? 'ui', options.bold);
    pdf.setFontSize(size).setTextColor(...(options.color ?? C.text));
    for (const line of split(text, size, options.maxWidth ?? width)) {
      ensure(lineHeight);
      pdf.text(line, x, y + size * 0.3528);
      y += lineHeight;
    }
    y += options.after ?? 1.5;
  }
  function kicker(text: string): void {
    write(text.toUpperCase(), { size: 7.5, bold: true, color: C.cyan, after: 2 });
  }
  function heading(title: string, subtitle?: string): void {
    write(title, { size: 25, kind: 'display', lineHeight: 9.5, after: 2 });
    if (subtitle) write(subtitle, { size: 10, color: C.muted, after: 7 });
  }
  function panel(height: number, color: Rgb = C.panel): void {
    ensure(height);
    pdf.setFillColor(...color).setDrawColor(...C.line).setLineWidth(0.25);
    pdf.roundedRect(margin, y, width, height, 3, 3, 'FD');
  }
  function multiline(text: string, x: number, top: number, size: number, maxWidth: number, color: Rgb,
    options: { kind?: 'ui' | 'display'; bold?: boolean; maxLines?: number; step?: number } = {}): number {
    font(options.kind ?? 'ui', options.bold);
    pdf.setFontSize(size).setTextColor(...color);
    const lines = split(text, size, maxWidth).slice(0, options.maxLines ?? 99);
    const step = options.step ?? size * 0.3528 * 1.35;
    lines.forEach((line, index) => pdf.text(line, x, top + index * step));
    return lines.length;
  }

  // Cover
  background();
  pdf.setFillColor(12, 26, 44).circle(pageWidth + 4, 36, 60, 'F');
  pdf.setDrawColor(...C.cyan).setLineWidth(0.35).circle(pageWidth - 10, 50, 47, 'S');
  pdf.setDrawColor(...C.blue).circle(pageWidth - 10, 50, 34, 'S');
  wordmark(margin, 20);
  fixed('INVESTIGATION REPORT', margin, 66, { size: 8, bold: true, color: C.cyan });
  fixed('Rapor', margin, 91, { size: 39, kind: 'display' });
  fixed('pemeriksaan klaim.', margin, 106, { size: 39, kind: 'display' });
  fixed('Pemeriksaan klaim saham Indonesia terhadap data yang tersedia,', margin, 125, { size: 12, color: C.muted });
  fixed('disusun agar angka, konteks, dan sumber dapat ditelusuri.', margin, 132, { size: 12, color: C.muted });
  pdf.setFillColor(...C.raised).setDrawColor(...C.line).roundedRect(margin, 155, width, 62, 4, 4, 'FD');
  const coverMeta = [
    ['SAHAM', meta.get('Saham') ?? '-'],
    ['WAKTU', meta.get('Waktu pemeriksaan') ?? '-'],
    ['SUMBER', meta.get('Sumber input') ?? '-'],
    ['CHECK ID', shortId],
  ];
  coverMeta.forEach(([label, value], index) => {
    const x = margin + 9 + (index % 2) * (width / 2);
    const top = 169 + Math.floor(index / 2) * 25;
    fixed(label!, x, top, { size: 7, bold: true, color: C.subtle });
    multiline(value!, x, top + 7, 10.5, width / 2 - 14, C.text, { maxLines: 2 });
  });
  multiline(report.overview, margin, 236, 10.5, width, C.muted, { maxLines: 4, step: 5 });
  fixed('Bukan nasihat investasi', margin, pageHeight - 16, { size: 8, bold: true });
  fixed('Data bersumber dari Sectors dan dapat tertinggal.', pageWidth - margin, pageHeight - 16,
    { size: 8, color: C.subtle, align: 'right' });

  // Reserve TOC pages so page references remain stable.
  const tocRowsPerPage = 20;
  const tocPageCount = Math.max(1, Math.ceil((report.claims.length + 2) / tocRowsPerPage));
  const tocPages: number[] = [];
  for (let index = 0; index < tocPageCount; index += 1) {
    pdf.addPage();
    background();
    tocPages.push(pdf.getNumberOfPages());
  }
  const toc: Array<{ label: string; detail: string; page: number }> = [];

  // Summary page
  newPage();
  toc.push({ label: 'Ringkasan laporan', detail: 'Metadata dan teks sumber', page: pdf.getNumberOfPages() });
  kicker('01 / Ringkasan');
  heading('Ringkasan laporan', report.overview);
  panel(44);
  fixed('TEKS YANG DIPERIKSA', margin + 7, y + 9, { size: 7, bold: true, color: C.subtle });
  multiline(`“${report.sourceText}”`, margin + 7, y + 19, 12, width - 14, C.text,
    { kind: 'display', maxLines: 5, step: 5.5 });
  y += 51;
  if (report.notice) {
    panel(18, [35, 28, 19]);
    multiline(report.notice, margin + 7, y + 11, 9, width - 14, verdictColors.misleading, { bold: true, maxLines: 2 });
    y += 24;
  }
  kicker('Detail pemeriksaan');
  for (const [key, value] of report.meta) {
    const valueLines = split(value, 9.5, width - 49);
    ensure(Math.max(11, valueLines.length * 4.5 + 3));
    fixed(key.toUpperCase(), margin, y + 5, { size: 7, bold: true, color: C.subtle });
    multiline(value, margin + 49, y + 5, 9.5, width - 49, C.text, { step: 4.5 });
    y += Math.max(11, valueLines.length * 4.5 + 3);
    pdf.setDrawColor(...C.line).setLineWidth(0.2).line(margin, y - 2, pageWidth - margin, y - 2);
  }

  report.claims.forEach((claim, index) => renderClaim(claim, index));

  function renderClaim(claim: ReportClaimSection, index: number): void {
    newPage();
    toc.push({ label: `Klaim ${String(index + 1).padStart(2, '0')}`, detail: claim.heading, page: pdf.getNumberOfPages() });
    const color = verdictColors[claim.verdict];
    kicker(`Klaim ${String(index + 1).padStart(2, '0')} / ${String(report.claims.length).padStart(2, '0')} · ${claim.heading}`);
    heading(claim.verdictLabel, claim.verdictSummary);
    pdf.setFillColor(...color).roundedRect(margin, y, 42, 8, 2, 2, 'F');
    fixed(claim.verdictLabel.toUpperCase(), margin + 21, y + 5.4, { size: 7, bold: true, color: C.canvas, align: 'center' });
    y += 15;
    panel(40);
    fixed('KLAIM', margin + 7, y + 9, { size: 7, bold: true, color: C.subtle });
    multiline(`“${claim.quote}”`, margin + 7, y + 19, 13, width - 14, C.text,
      { kind: 'display', maxLines: 5, step: 5.7 });
    y += 47;
    ensure(34);
    const metricWidth = (width - 6) / 2;
    [['DIKLAIM', claim.claimed], ['HASIL PEMBANDING', claim.compared]].forEach(([label, value], metricIndex) => {
      const x = margin + metricIndex * (metricWidth + 6);
      pdf.setFillColor(...C.raised).setDrawColor(...C.line).roundedRect(x, y, metricWidth, 29, 3, 3, 'FD');
      fixed(label!, x + 6, y + 8, { size: 7, bold: true, color: C.subtle });
      multiline(value!, x + 6, y + 21, 18, metricWidth - 12, metricIndex ? color : C.text,
        { kind: 'display', maxLines: 1 });
    });
    y += 35;
    write(claim.comparisonNote, { size: 9, color: C.muted, after: 5 });

    if (claim.contexts.length) {
      kicker('Konteks yang perlu diketahui');
      for (const context of claim.contexts) {
        const contextLines = split(context.summary, 9, width - 18);
        const height = 15 + contextLines.length * 4.5;
        panel(height);
        fixed(context.title, margin + 7, y + 9, { size: 9, bold: true, color });
        multiline(context.summary, margin + 7, y + 16, 9, width - 18, C.muted, { step: 4.5 });
        y += height + 5;
      }
    }
    if (claim.explanation) {
      kicker('Penjelasan');
      write(claim.explanation, { size: 10, after: 6 });
    }
    if (claim.evidence.length) {
      kicker(`Bukti data / ${String(claim.evidence.length).padStart(2, '0')}`);
      claim.evidence.forEach((line, evidenceIndex) => {
        const labelLines = split(line.label, 9, width - 55);
        const sourceLines = split(line.source, 7.5, width - 55);
        const height = Math.max(18, 8 + labelLines.length * 4.2 + sourceLines.length * 3.8);
        panel(height);
        fixed(String(evidenceIndex + 1).padStart(2, '0'), margin + 6, y + 9, { size: 7, bold: true, color: C.subtle });
        multiline(line.label, margin + 17, y + 8, 9, width - 55, C.text, { bold: true, step: 4.2 });
        multiline(line.source, margin + 17, y + 9 + labelLines.length * 4.2, 7.5, width - 55, C.subtle, { step: 3.8 });
        fixed(line.value, pageWidth - margin - 6, y + 10, { size: 10, kind: 'display', color, align: 'right' });
        y += height + 3;
      });
    }
  }

  // Disclaimer page
  newPage();
  toc.push({ label: 'Catatan penting', detail: 'Batas penggunaan dan metodologi', page: pdf.getNumberOfPages() });
  kicker(`${String(report.claims.length + 2).padStart(2, '0')} / Catatan`);
  heading('Baca hasil dengan konteks.', 'Rapor ini memeriksa kesesuaian klaim dengan data yang tersedia, bukan keputusan investasi.');
  panel(55);
  fixed('DISCLAIMER', margin + 8, y + 11, { size: 7, bold: true, color: C.cyan });
  multiline(report.disclaimer, margin + 8, y + 22, 10, width - 16, C.text, { step: 5 });
  y += 64;
  kicker('Cara membaca rapor');
  const notes = [
    ['Status', 'Menilai kecocokan klaim terhadap data dan konteks yang ditemukan.'],
    ['Hasil pembanding', 'Angka yang dihitung kode dari evidence, bukan perhitungan LLM.'],
    ['Bukti data', 'Menunjukkan metrik, sumber Sectors, dan tanggal data yang digunakan.'],
  ];
  for (const [label, description] of notes) {
    panel(22);
    fixed(label!, margin + 7, y + 9, { size: 9, bold: true });
    multiline(description!, margin + 43, y + 9, 9, width - 50, C.muted, { maxLines: 2 });
    y += 27;
  }

  // Fill TOC after page destinations are known.
  tocPages.forEach((pageNumber, tocIndex) => {
    pdf.setPage(pageNumber);
    background();
    let tocY = contentTop;
    fixed(`${String(tocIndex + 1).padStart(2, '0')} / DAFTAR ISI`, margin, tocY, { size: 7.5, bold: true, color: C.cyan });
    fixed(tocIndex === 0 ? 'Daftar isi' : 'Daftar isi (lanjutan)', margin, tocY + 17, { size: 27, kind: 'display' });
    tocY += 32;
    toc.slice(tocIndex * tocRowsPerPage, (tocIndex + 1) * tocRowsPerPage).forEach((entry, entryIndex) => {
      const number = tocIndex * tocRowsPerPage + entryIndex + 1;
      fixed(String(number).padStart(2, '0'), margin, tocY + 5, { size: 7, bold: true, color: C.subtle });
      fixed(entry.label, margin + 14, tocY + 4.5, { size: 10, bold: true });
      multiline(entry.detail, margin + 14, tocY + 10, 8, width - 43, C.muted, { maxLines: 1 });
      pdf.setDrawColor(...C.line).setLineWidth(0.2).line(margin + 14, tocY + 14, pageWidth - margin, tocY + 14);
      fixed(String(entry.page), pageWidth - margin, tocY + 7, { size: 9, kind: 'display', color: C.cyan, align: 'right' });
      tocY += 11.5;
    });
  });

  // Shared header/footer template, except the cover.
  const pages = pdf.getNumberOfPages();
  for (let page = 2; page <= pages; page += 1) {
    pdf.setPage(page);
    wordmark(margin, 10, true);
    fixed('RAPOR PEMERIKSAAN', pageWidth / 2, 16, { size: 7, bold: true, color: C.subtle, align: 'center' });
    fixed(`CHECK / ${shortId}`, pageWidth - margin, 16, { size: 7, bold: true, color: C.subtle, align: 'right' });
    pdf.setDrawColor(...C.line).setLineWidth(0.25).line(margin, 23, pageWidth - margin, 23);
    pdf.setDrawColor(...C.cyan).setLineWidth(0.5).line(margin, pageHeight - 18, margin + 25, pageHeight - 18);
    fixed('Cek Dulu · alat informasi, bukan nasihat investasi', margin, pageHeight - 10, { size: 7, color: C.subtle });
    fixed(`${String(page).padStart(2, '0')} / ${String(pages).padStart(2, '0')}`, pageWidth - margin, pageHeight - 10,
      { size: 7.5, kind: 'display', color: C.muted, align: 'right' });
  }
  return pdf.output('blob');
}
