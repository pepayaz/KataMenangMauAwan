import type { Claim, ClaimType, Evidence, TraceEvent } from '@cek-dulu/shared';
import type { DateWindow, SectorsClient, ToolResult } from '@cek-dulu/sectors';

export type VerifierContext = {
  client: SectorsClient;
  checkId: string;
  /** Tanggal acuan ISO (YYYY-MM-DD). Disuntik supaya uji tidak bergantung jam dinding. */
  today: string;
  /** Jendela hasil router. Bila ada, verifier memakainya alih-alih menafsirkan frasa sendiri. */
  window?: DateWindow;
  emit?: (event: TraceEvent) => void;
};

export type VerifierOutput = {
  evidence: Evidence[];
  /** Angka pembanding utama yang dihitung dari data resmi. */
  computed?: { value: number; unit: string; evidenceId: string };
  /**
   * Apakah angka yang diklaim cocok dengan data, dalam toleransi tipe ini.
   * `null` berarti tidak bisa dinilai — data tidak ada atau klaim terlalu kabur.
   * Verifier tidak pernah memutuskan verdict; itu tugas adjudicator (bab 3.5).
   */
  matches: boolean | null;
  /** Deskripsi toleransi yang dipakai, untuk ditampilkan di rapor. */
  tolerance: string;
  note: string;
  /**
   * Angka turunan yang sudah dihitung verifier dan berguna bagi hipotesis
   * Context Hunter (A), mis. daftar pembayaran dividen per tanggal. Menaruhnya
   * di sini menghindari pemanggilan endpoint yang sama dua kali.
   */
  details?: Record<string, unknown>;
};

export type Verifier = (claim: Claim, ctx: VerifierContext) => Promise<VerifierOutput>;

export type VerifierRegistry = Record<ClaimType, Verifier>;

/**
 * `evidenceId` sengaja deterministik: klaim yang sama atas data yang sama
 * selalu menghasilkan id yang sama, jadi laporan evaluasi bisa dibandingkan
 * antar-jalan dan grounding validator punya rujukan yang stabil.
 */
export function evidenceId(claimId: string, label: string): string {
  const slug = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${claimId}:${slug}`;
}

/** Membangun Evidence dari hasil panggilan alat, menjaga jejak asal-usulnya. */
export function makeEvidence(
  claimId: string,
  result: Pick<ToolResult<unknown>, 'endpoint' | 'params' | 'credits' | 'cached' | 'fetchedAt'>,
  label: string,
  value: number | string,
  unit?: string,
): Evidence {
  const ev: Evidence = {
    evidenceId: evidenceId(claimId, label),
    claimId,
    tool: result.endpoint,
    params: result.params,
    credits: result.credits,
    cached: result.cached,
    fetchedAt: result.fetchedAt,
    label,
    value,
  };
  if (unit !== undefined) ev.unit = unit;
  return ev;
}

/** Hasil kosong dengan alasan — dipakai saat data tidak tersedia. */
export function unverifiable(note: string, tolerance = '-'): VerifierOutput {
  return { evidence: [], matches: null, tolerance, note };
}
