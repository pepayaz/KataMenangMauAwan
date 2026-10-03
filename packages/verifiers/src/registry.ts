import type { ClaimType } from '@cek-dulu/shared';
import { verifyValuation } from './valuation.js';
import { verifyDividend } from './dividend.js';
import { verifyPriceMove } from './price-move.js';
import { verifyEarningsGrowth } from './earnings-growth.js';
import { verifyForeignFlow } from './foreign-flow.js';
import { verifyAccumulation } from './accumulation.js';
import { verifySafety } from './safety.js';
import type { Verifier, VerifierRegistry } from './types.js';

/** Peta tipe klaim ke verifier. Router (A) memakai peta ini, bukan `switch` sendiri. */
export const VERIFIERS: VerifierRegistry = {
  valuation: verifyValuation,
  dividend: verifyDividend,
  price_move: verifyPriceMove,
  earnings_growth: verifyEarningsGrowth,
  foreign_flow: verifyForeignFlow,
  accumulation: verifyAccumulation,
  safety: verifySafety,
};

export function getVerifier(type: ClaimType): Verifier {
  return VERIFIERS[type];
}

/**
 * Tipe yang aktif sesuai feature flag (bab 2.1).
 * Tipe 1-3 adalah inti P0 dan tidak pernah dimatikan.
 */
export const CORE_CLAIM_TYPES: ClaimType[] = ['valuation', 'dividend', 'price_move'];
export const EXTENDED_CLAIM_TYPES: ClaimType[] = [
  'earnings_growth',
  'foreign_flow',
  'accumulation',
  'safety',
];

export function enabledClaimTypes(flags: Record<string, boolean>): ClaimType[] {
  return flags.claim_types_ext === true
    ? [...CORE_CLAIM_TYPES, ...EXTENDED_CLAIM_TYPES]
    : [...CORE_CLAIM_TYPES];
}
