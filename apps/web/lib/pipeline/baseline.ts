import {
  MANUAL_ALIASES,
  resolveEntities,
  type AliasEntry,
  type CheckInput,
  type CheckResult,
  type Claim,
  type ClaimVerdict,
  type Evidence,
  type HypothesisResult,
} from '@cek-dulu/shared';
import { SectorsError } from '@cek-dulu/sectors';
import { enabledClaimTypes, getVerifier, type VerifierOutput } from '@cek-dulu/verifiers';
import { adjudicate, deriveMissingContext } from './adjudicate.js';
import { extractClaims } from './extract.js';
import type { Pipeline, PipelineContext } from './types.js';

/**
 * Pipeline dasar milik B.
 *
 * Bab 10 menjadwalkan pipeline agen lengkap (A) mendarat Sabtu sore, sementara
 * route `/api/check` harus sudah mengalir ke UI sejak Sabtu siang. Daripada
 * mengembalikan fixture mati, route memakai pipeline ini: normalizer dan
 * ekstraktor berbasis aturan, verifier sungguhan milik B, adjudicator berbasis
 * tabel bab 1.4. Hasilnya cek yang benar-benar memanggil data resmi sejak hari
 * pertama, dan A cukup menukar implementasi lewat `createPipeline`.
 *
 * Yang belum ada di sini dan memang milik A: ekstraktor LLM, pustaka hipotesis
 * penuh, pemilih hipotesis berbasis LLM, dan penulis penjelasan.
 */
export class BaselinePipeline implements Pipeline {
  readonly name = 'baseline';

  constructor(private readonly aliases: AliasEntry[] = MANUAL_ALIASES) {}

  async run(input: CheckInput, ctx: PipelineContext): Promise<CheckResult> {
    const startedAt = Date.now();

    // --- 1. Normalizer -----------------------------------------------------
    ctx.emit({ stage: 'normalize', message: 'Membaca teks dan mencari kode saham.' });
    const cleanText = normalize(input.rawText);
    const entities = resolveEntities(cleanText, { aliases: this.aliases });

    if (entities.length === 0) {
      ctx.emit({
        stage: 'error',
        message: 'Tidak ada emiten yang dikenali di teks ini.',
      });
      return emptyResult(input, entities);
    }

    ctx.emit({
      stage: 'normalize',
      message: `Emiten dikenali: ${entities.map((e) => e.ticker).join(', ')}.`,
      data: { entities },
    });

    // --- 2. Extractor ------------------------------------------------------
    ctx.emit({ stage: 'extract', message: 'Memecah teks menjadi klaim yang bisa dicek.' });
    const claims = extractClaims(cleanText, {
      checkId: input.checkId,
      entities,
      enabledTypes: enabledClaimTypes(ctx.flags),
    });

    if (claims.length === 0) {
      ctx.emit({ stage: 'extract', message: 'Tidak ada klaim berangka yang bisa diperiksa.' });
      return emptyResult(input, entities);
    }

    ctx.emit({
      stage: 'extract',
      message: `${claims.length} klaim ditemukan.`,
      data: { claims },
    });

    // --- 3-6. Router, verifier, hunter, adjudicator ------------------------
    const evidence: Evidence[] = [];
    const hypothesisRuns: HypothesisResult[] = [];
    const verdicts: ClaimVerdict[] = [];
    let creditsUsed = 0;

    for (const claim of claims) {
      if (ctx.signal?.aborted === true) break;

      if (!claim.inScope) {
        ctx.emit({
          stage: 'adjudicate',
          message: `Klaim "${claim.asserted.metric}" adalah prediksi; dilewati.`,
          data: { claimId: claim.claimId },
        });
        verdicts.push(adjudicate({ claim, output: emptyOutput(), missingContext: [] }));
        continue;
      }

      ctx.emit({
        stage: 'route',
        message: `Menyiapkan pemeriksaan ${claim.type} untuk ${claim.ticker}.`,
        data: { claimId: claim.claimId, type: claim.type },
      });

      let output: VerifierOutput;
      try {
        ctx.emit({
          stage: 'verify',
          message: `Mengambil data resmi ${claim.ticker}.`,
          data: { claimId: claim.claimId },
        });
        output = await getVerifier(claim.type)(claim, {
          client: ctx.client,
          checkId: input.checkId,
          today: ctx.today,
        });
      } catch (err) {
        const message =
          err instanceof SectorsError
            ? err.message
            : `Gagal memeriksa klaim: ${err instanceof Error ? err.message : String(err)}`;
        ctx.emit({ stage: 'error', message, data: { claimId: claim.claimId } });
        output = {
          evidence: [],
          matches: null,
          tolerance: '-',
          note: message,
        };
      }

      const claimCredits = output.evidence.reduce((s, e) => s + e.credits, 0);
      creditsUsed += claimCredits;
      evidence.push(...output.evidence);

      ctx.emit({
        stage: 'verify',
        message: output.note !== '' ? output.note : 'Pemeriksaan selesai.',
        data: { claimId: claim.claimId, matches: output.matches },
        credits: claimCredits,
      });

      // Hipotesis konteks deterministik. Pustaka penuh milik A menggantikan ini.
      ctx.emit({
        stage: 'hunt',
        message: `Mencari konteks yang hilang untuk klaim ${claim.ticker}.`,
        data: { claimId: claim.claimId },
      });
      const missingContext = deriveMissingContext(claim, output);
      for (const c of missingContext) {
        hypothesisRuns.push({
          hypId: c.hypId,
          claimId: claim.claimId,
          triggered: true,
          strength: 'strong',
          evidenceIds: c.evidenceIds,
          note: c.summary,
        });
      }
      if (missingContext.length > 0) {
        ctx.emit({
          stage: 'hunt',
          message: `${missingContext.length} konteks penting ditemukan.`,
          data: { claimId: claim.claimId, hypotheses: missingContext.map((c) => c.hypId) },
        });
      }

      const verdict = adjudicate({ claim, output, missingContext });
      verdicts.push(verdict);
      ctx.emit({
        stage: 'adjudicate',
        message: `Status klaim ${claim.ticker}: ${verdict.verdict}.`,
        data: { claimId: claim.claimId, verdict: verdict.verdict },
      });
    }

    const elapsed = Math.round((Date.now() - startedAt) / 100) / 10;
    ctx.emit({
      stage: 'done',
      message: `Selesai dalam ${elapsed} detik, ${creditsUsed} kredit terpakai.`,
      credits: creditsUsed,
    });

    return {
      checkId: input.checkId,
      entities,
      claims,
      evidence,
      hypothesisRuns,
      verdicts,
      creditsUsed,
      finishedAt: new Date().toISOString(),
    };
  }
}

/**
 * Normalizer teks (bab 3.1): membuang derau media sosial yang membuat pola
 * angka dan ticker gagal cocok, tanpa mengubah posisi kata yang penting.
 */
export function normalize(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function emptyOutput(): VerifierOutput {
  return { evidence: [], matches: null, tolerance: '-', note: '' };
}

function emptyResult(input: CheckInput, entities: CheckResult['entities']): CheckResult {
  return {
    checkId: input.checkId,
    entities,
    claims: [] as Claim[],
    evidence: [],
    hypothesisRuns: [],
    verdicts: [],
    creditsUsed: 0,
    finishedAt: new Date().toISOString(),
  };
}
