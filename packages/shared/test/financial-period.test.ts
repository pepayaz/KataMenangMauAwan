import { describe, expect, it } from 'vitest';
import { parseFinancialPeriod, financialQuarterEnds } from '../src/financial-period.js';
describe('periods in financial news', () => {
 it.each(['hingga kuartal tiga 2025','sampai Q3 2025','kumulatif Q3 2025','YTD Q3 2025','9M 2025','9 bulan 2025'])('parses cumulative %s', text => {
  expect(parseFinancialPeriod(text)).toMatchObject({kind:'ytd',q:3,year:2025,reportDate:'2025-09-30'});
  expect(financialQuarterEnds(parseFinancialPeriod(text)!)).toEqual(['03-31','06-30','09-30']);
 });
 it('keeps standalone quarter and H2 distinct from YTD',()=>{
  expect(parseFinancialPeriod('kuartal tiga 2025')?.kind).toBe('quarter');
  expect(financialQuarterEnds(parseFinancialPeriod('Semester II 2025')!)).toEqual(['09-30','12-31']);
 });
});
