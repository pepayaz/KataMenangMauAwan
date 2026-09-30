/** Span klaim mengacu teks ini; modul tanpa dependensi server agar rapor memakai aturan yang sama. */
export function cleanText(raw: string): string {
  return raw.replace(/\r\n?/g, '\n').replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\t\u00A0 ]+/g, ' ').replace(/ *\n */g, '\n').trim();
}
