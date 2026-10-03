/** Normalisasi simbol IDX. Sectors menerima `BBCA` dan `BBCA.JK`, mengembalikan `BBCA.JK`. */
export function normalizeTicker(input: string): string {
  return input.trim().toUpperCase().replace(/\.JK$/i, '');
}

export function withSuffix(input: string): string {
  return `${normalizeTicker(input)}.JK`;
}

/** Pola kode saham eksplisit: $ADRO, #BBRI, atau empat huruf kapital. */
export function extractExplicitTickers(text: string): string[] {
  const out = new Set<string>();
  const re = /[$#]([A-Za-z]{4})\b|\b([A-Z]{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const t = (m[1] ?? m[2] ?? '').toUpperCase();
    if (t.length === 4) out.add(t);
  }
  return [...out];
}
