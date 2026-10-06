import { z } from 'zod';
import { ENDPOINTS, REPORT_SECTIONS, SectorsError, estimateCredits, type EndpointName, type SectorsClient, type ToolResult } from '@cek-dulu/sectors';
import { flattenHunterToolResult } from './evidence.js';
import { HunterToolError, type HunterToolGateway } from './executor.js';

const symbol = z.string().regex(/^[A-Z]{4}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
const reportParams = z.object({ symbol, sections: z.array(z.enum(REPORT_SECTIONS)).min(1) }).strict();
const symbolParams = z.object({ symbol }).strict();
const dailyParams = z.object({ symbol, start: date, end: date }).strict().refine((p) => {
  const days = (Date.parse(p.end) - Date.parse(p.start)) / 86_400_000 + 1;
  return days > 0 && days <= ENDPOINTS.fetchDailyPrice.maxWindowDays!;
});

const LIVE_TOOLS = new Set(['fetchCompanyReport', 'fetchCorporateActions', 'fetchDailyPrice']);

/**
 * Gateway hunter di atas client B. Offline (cache_only/replay) selalu gratis.
 * Live memesan estimasi kredit di muka lewat `quote`; client tetap menegakkan
 * anggaran cek dan anggaran anggota sebelum jaringan disentuh.
 */
export function createSectorsHunterGateway(client: SectorsClient, today: string): HunterToolGateway {
  const live = client.mode === 'live';
  return {
    async quote(call) {
      if (!live || !LIVE_TOOLS.has(call.tool)) return 0;
      return estimateCredits(call.tool as EndpointName, call.params);
    },
    async execute(call, { claim, maxCredits }) {
      if (maxCredits < 0) throw new HunterToolError(0);
      let response: ToolResult<unknown>;
      try {
        if (call.tool === 'fetchCompanyReport') {
          const params = reportParams.parse(call.params);
          if (params.symbol !== claim.ticker) throw new Error('Simbol berbeda.');
          response = await client.fetchCompanyReport(params.symbol, params.sections, { checkId: claim.checkId });
        } else if (call.tool === 'fetchCorporateActions') {
          const params = symbolParams.parse(call.params);
          if (params.symbol !== claim.ticker) throw new Error('Simbol berbeda.');
          response = await client.fetchCorporateActions(params.symbol, { checkId: claim.checkId });
        } else if (call.tool === 'fetchDailyPrice') {
          const params = dailyParams.parse(call.params);
          if (params.symbol !== claim.ticker) throw new Error('Simbol berbeda.');
          response = await client.fetchDailyPrice(params.symbol, { start: params.start, end: params.end }, { checkId: claim.checkId });
        } else throw new Error('Tool tidak didukung.');
        return { evidence: flattenHunterToolResult(claim, response, today), credits: response.credits };
      } catch (error) {
        // 404 di mode live tetap menagih 1 kredit (lihat client B).
        const billed = live && error instanceof SectorsError && error.code === 'NOT_FOUND' ? Math.min(1, maxCredits) : 0;
        throw new HunterToolError(billed, error instanceof SectorsError && ['CACHE_MISS', 'REPLAY_MISS', 'NOT_FOUND', 'NO_DATA'].includes(error.code)
          ? 'missing_data' : 'tool_error');
      }
    },
  };
}
