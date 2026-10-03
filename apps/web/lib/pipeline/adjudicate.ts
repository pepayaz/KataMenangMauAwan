import type { Claim, ClaimVerdict, MissingContext, Verdict } from '@cek-dulu/shared';
import type { VerifierOutput } from '@cek-dulu/verifiers';

/**
 * Adjudicator berbasis aturan (bab 3.5, tabel bab 1.4).
 *
 * Status ditentukan kode, bukan prompt. LLM (A) hanya menulis ulang penjelasan
 * dalam bahasa awam, dan grounding validator (bab 3.6) menolak tulisan yang
 * memuat angka di luar evidence. Berkas ini menyediakan penjelasan deterministik
 * yang dipakai apa adanya bila LLM tidak tersedia atau tulisannya ditolak dua kali.
 */

export type AdjudicationInput = {
  claim: Claim;
  output: VerifierOutput;
  /** Konteks yang ditemukan Context Hunter (A) atau turunan deterministik verifier. */
  missingContext: MissingContext[];
};

export function adjudicate(input: AdjudicationInput): ClaimVerdict {
  const { claim, output, missingContext } = input;
  const evidenceIds = output.evidence.map((e) => e.evidenceId);

  const verdict = decideVerdict(claim, output, missingContext);
  const explanation = describe(claim, output, missingContext, verdict);

  const result: ClaimVerdict = {
    claimId: claim.claimId,
    verdict,
    missingContext,
    explanation,
    evidenceIds,
  };
  if (output.computed) result.computed = output.computed;
  return result;
}

function decideVerdict(
  claim: Claim,
  output: VerifierOutput,
  missingContext: MissingContext[],
): Verdict {
  // Prediksi dan opini tidak pernah diverifikasi (bab 1.4).
  if (!claim.inScope) return 'out_of_scope';

  // "Tidak ada angka tanpa evidence" ditegakkan di sini, bukan di prompt:
  // tanpa evidence, satu-satunya status yang jujur adalah tidak bisa diverifikasi.
  if (output.evidence.length === 0) return 'unverifiable';
  if (output.matches === null) return 'unverifiable';

  if (output.matches === false) return 'refuted';

  // Angka cocok. Konteks yang mengubah maknanya membuatnya menyesatkan,
  // bukan didukung — itu inti nilai jual produk (bab 1.4 baris tiga).
  return missingContext.length > 0 ? 'misleading' : 'supported';
}

function describe(
  claim: Claim,
  output: VerifierOutput,
  missingContext: MissingContext[],
  verdict: Verdict,
): string {
  if (verdict === 'out_of_scope') {
    return `Kalimat ini prediksi atau opini, bukan klaim tentang angka yang bisa dicek terhadap data ${claim.ticker}.`;
  }
  if (verdict === 'unverifiable') {
    return output.note !== ''
      ? output.note
      : `Data untuk memeriksa klaim ini tentang ${claim.ticker} tidak tersedia.`;
  }

  const parts = [output.note];
  if (missingContext.length > 0) {
    parts.push(...missingContext.map((c) => c.summary));
  }
  if (verdict === 'supported') {
    parts.push(`Toleransi pemeriksaan: ${output.tolerance}.`);
  }
  return parts.filter((p) => p !== '').join(' ');
}

/**
 * Konteks yang bisa ditemukan tanpa LLM, langsung dari angka yang sudah
 * dihitung verifier.
 *
 * Ini lantai, bukan langit-langit: pustaka hipotesis lengkap milik A (bab 3.4).
 * Tiga hipotesis di bawah dipilih karena bisa diputuskan secara deterministik
 * dan tepat menutup kasus demo — DIV_TTM_GAP untuk ADRO, FGN_WINDOW untuk BBRI,
 * dan PRC_SPLIT untuk kenaikan harga yang belum disesuaikan.
 */
export function deriveMissingContext(claim: Claim, output: VerifierOutput): MissingContext[] {
  const out: MissingContext[] = [];
  const details = output.details ?? {};
  const evidenceIds = output.evidence.map((e) => e.evidenceId);

  if (claim.type === 'dividend') {
    const basis = details.matchedBasis;
    const ttm = details.yieldTtm;
    if (basis !== null && basis !== 'ttm' && typeof ttm === 'number') {
      out.push({
        hypId: 'DIV_TTM_GAP',
        summary:
          `Angka yang dipakai bukan yield dua belas bulan terakhir, yang hanya ` +
          `${pct(ttm)}. Pembeli hari ini menerima yield TTM, bukan rata-rata masa lalu.`,
        evidenceIds: evidenceIds.filter((id) => id.includes('yield')),
      });
    }
    const cashPayout = details.cashPayoutRatio;
    if (typeof cashPayout === 'number' && (cashPayout < 0 || cashPayout > 1)) {
      out.push({
        hypId: 'DIV_CASH_PAYOUT',
        summary:
          `Cash payout ratio ${round2(cashPayout)} berada di luar rentang wajar 0 sampai 1, ` +
          'artinya dividen tidak ditutup arus kas periode berjalan.',
        evidenceIds: evidenceIds.filter((id) => id.includes('cash-payout')),
      });
    }
  }

  if (claim.type === 'price_move') {
    const splits = details.splits;
    if (Array.isArray(splits) && splits.length > 0) {
      out.push({
        hypId: 'PRC_SPLIT',
        summary: `Ada ${splits.length} aksi stock split di jendela ini, sehingga harga per lembar tidak setara.`,
        evidenceIds: evidenceIds.filter((id) => id.includes('stock-split')),
      });
    }
    const low = details.lowClose;
    const high = details.highClose;
    if (typeof low === 'number' && typeof high === 'number' && low > 0 && high / low > 2) {
      out.push({
        hypId: 'PRC_LOW_BASE',
        summary:
          `Kenaikan dihitung dari titik terendah ${low}; harga tertinggi di jendela yang sama ${high}. ` +
          'Memilih titik awal lain memberi angka yang jauh berbeda.',
        evidenceIds: evidenceIds.filter((id) => id.includes('terendah') || id.includes('tertinggi')),
      });
    }
  }

  if (claim.type === 'foreign_flow') {
    const byWindow = details.byWindow as Record<string, { net: number }> | undefined;
    const summary = details.summary as { net: number } | undefined;
    if (byWindow && summary) {
      const opposite = Object.entries(byWindow).filter(
        ([, s]) => Math.sign(s.net) !== 0 && Math.sign(s.net) !== Math.sign(summary.net),
      );
      if (opposite.length > 0) {
        out.push({
          hypId: 'FGN_WINDOW',
          summary:
            `Jendela lain bergerak berlawanan arah: ${opposite
              .map(([d, s]) => `${d} hari ${s.net > 0 ? 'beli' : 'jual'} bersih`)
              .join(', ')}. Arah arus asing bergantung jendela yang dipilih.`,
          evidenceIds: evidenceIds.filter((id) => id.includes('net-arus-asing')),
        });
      }
    }
  }

  return out;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1).replace('.', ',')}%`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
