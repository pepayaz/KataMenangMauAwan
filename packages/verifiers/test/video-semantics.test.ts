import { describe, expect, it } from 'vitest';
import { literalBound, resolveFinancialMetric, claimHash } from '@cek-dulu/shared';
import { verifyDividend } from '../src/dividend.js';
import { verifyValuation } from '../src/valuation.js';
import { withinRelative } from '../src/tolerance.js';
import { ctx, makeClaim, seededClient } from './helpers.js';
const dividendClient = (yieldValue: number, payout: number | null = 0.4) => seededClient([{endpoint:'fetchCompanyReport',params:{symbol:'GJTL',sections:['dividend']},response:{dividend:{yield_ttm:yieldValue,payout_ratio:payout,dividend_yield_avg:{period:5,avg_yield:0.12},historical_dividends:{'2024':{total_yield:0.15}}}}}]);
describe('real video metric and bound regressions',()=>{
 it.each([['PBV < ','lt'],['yield di atas ','gt'],['payout di bawah ','lt'],['minimal ','gte'],['<= ','lte'],['tidak kurang dari ','gte'],['tidak di atas ','lte']] as const)('keeps the literal operator %s', (prefix,comparison)=>expect(literalBound(prefix)).toBe(comparison));
 it('never matches a nonzero claimed percentage with an actual zero under relative tolerance',()=>{expect(withinRelative(0.06,0,0.1)).toBe(false);expect(withinRelative(0,0,0.1)).toBe(true);});
 it.each([[0,false],[0.05,false],[0.06,false],[0.07,true]])('checks yield above 6%% against TTM %s, without substituting old annual yields',async(value,expected)=>{
  const c=makeClaim('dividend','GJTL',{metric:'dividend yield',value:6,unit:'%',comparison:'gt'});
  const result=await verifyDividend(c,ctx(dividendClient(value)));expect(result.matches).toBe(expected);expect(result.computed?.value).toBe(value);
 });
 it('compares payout below 60% with payout, never yield',async()=>{
  const c=makeClaim('dividend','GJTL',{metric:'dividend payout ratio',value:60,unit:'%',comparison:'lt'});
  const result=await verifyDividend(c,ctx(dividendClient(0.9,0.4)));expect(result.matches).toBe(true);expect(result.computed?.value).toBe(0.4);expect(result.details?.coverage).toMatchObject({field:'dividend.payout_ratio'});
  expect((await verifyDividend(c,ctx(dividendClient(0.01,0.8)))).matches).toBe(false);
 });
 it('does not substitute current payout when a historical period is explicitly requested',async()=>{
  const c=makeClaim('dividend','GJTL',{metric:'dividend payout ratio',value:60,unit:'%',period:'2023',comparison:'lt'});
  expect((await verifyDividend(c,ctx(dividendClient(0.06)))).matches).toBeNull();
 });
 it.each([[0.4,true],[1,false],[1.03,false]])('checks PBV below 1 against %s',async(value,expected)=>{
  const client=seededClient([{endpoint:'fetchCompanyReport',params:{symbol:'GJTL',sections:['valuation']},response:{valuation:{historical_valuation:[{year:2026,pb:value}]}}}]);
  const c=makeClaim('valuation','GJTL',{metric:'PBV',value:1,unit:'x',comparison:'lt'});
  expect((await verifyValuation(c,ctx(client))).matches).toBe(expected);
 });
 it.each(['penjualan segmen kebutuhan rumah tangga','porsi laba ditahan','retained profit'])('refuses the unrelated company-total/growth substitute for %s',metric=>expect(resolveFinancialMetric(metric)).toBeNull());
 it('distinguishes an equality claim from a bound in history',()=>{
  const c=makeClaim('valuation','GJTL',{metric:'PBV',value:1,unit:'x'});expect(claimHash(c)).not.toBe(claimHash({...c,asserted:{...c.asserted,comparison:'lt'}}));
 });
});
