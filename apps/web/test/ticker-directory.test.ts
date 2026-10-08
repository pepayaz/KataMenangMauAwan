import { describe, expect, it } from 'vitest';
import { loadAliases } from '../lib/aliases.js';
import { createFixtureTickerDirectory, normalizeText } from '@cek-dulu/agent';
describe('official bundled ticker directory',()=>{
 it('recognizes all six tickers from failed videos with no database or live requests',async()=>{
  const aliases=await loadAliases(null);
  const directory=createFixtureTickerDirectory({tickers:aliases.map(x=>x.ticker),aliases});
  const result=await normalizeText('ULTJ: yield 9%. MLBI: yield 8%. DLTA: yield 10%. GJTL AUTO BJTM PBV 0,9x.',{directory});
  expect(result.entities.map(x=>x.ticker).sort()).toEqual(['AUTO','BJTM','DLTA','GJTL','MLBI','ULTJ']);
  expect(result.status).toBe('ready');
 });
 it('does not confuse ordinary banking prose with valid common-word tickers',async()=>{
  const aliases=await loadAliases(null);
  const directory=createFixtureTickerDirectory({tickers:aliases.map(x=>x.ticker),aliases});
  const result=await normalizeText('Saham Bank BTN (BBTN) labanya naik 40% pada semester satu. Utang dan uang kas. BANK LABA NAIK PADA SATU.',{directory});
  expect(result.entities.map(x=>x.ticker)).toEqual(['BBTN']);
  expect((await normalizeText('$BANK PBV 1x',{directory})).entities.map(x=>x.ticker)).toEqual(['BANK']);
  expect((await normalizeText('Saham BANK PBV 1x',{directory})).entities.map(x=>x.ticker)).toEqual(['BANK']);
 });
 it('asks about a ticker-shaped unknown instead of silently returning no claims',async()=>{
  expect(await normalizeText('ZZZZ: laba naik 10%')).toMatchObject({status:'needs_user_choice',choices:[{surface:'ZZZZ',reason:'unknown_ticker'}]});
  expect((await normalizeText('BANK SAYA JUGA')).entities).toEqual([]);
 });
});
