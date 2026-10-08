import { createHash } from 'node:crypto';
import type { Claim } from './schemas.js';
import { roundTo } from './number-id.js';

/**
 * claim_hash = hash(ticker + type + metric + nilai dibulatkan) — bab 6.5.
 *
 * Dipakai riwayat untuk mengenali klaim yang sama dicek ulang, lalu
 * membandingkan verdict lama dengan yang baru (deteksi "status berubah").
 * Pembulatan sengaja kasar: "yield 25,5%" dan "yield 25,52%" adalah klaim yang
 * sama bagi pengguna.
 */
export function claimHash(claim: Pick<Claim, 'ticker' | 'type' | 'asserted'>): string {
  const metric = claim.asserted.metric.trim().toLowerCase();
  const value =
    typeof claim.asserted.value === 'number' ? String(roundTo(claim.asserted.value, 1)) : 'null';
  const unit = claim.asserted.unit ?? 'null';
  const window = claim.asserted.window?.trim().toLowerCase() ?? 'null';
  const fields = [claim.ticker.toUpperCase(), claim.type, metric, value, unit, window];
  if (claim.asserted.comparison) fields.push(claim.asserted.comparison);
  const key = fields.join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}
