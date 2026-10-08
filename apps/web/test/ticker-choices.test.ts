import { expect, it } from 'vitest';
import { tickerSelections, type UiTickerChoice } from '../lib/ticker-choices';
import { normalizeText, createFixtureTickerDirectory } from '../../../packages/agent/src/normalizer';
const choices: UiTickerChoice[] = [
  { surface: 'bara', reason: 'ambiguous_alias', candidates: [{ ticker: 'ADRO', label: 'Adaro', score: 1 }, { ticker: 'PTBA', label: 'Bukit Asam', score: 1 }] },
  { surface: 'Adarro', reason: 'no_llm', candidates: [{ ticker: 'ADRO', label: 'Adaro', score: 0.9 }] },
];
const directory = createFixtureTickerDirectory({ tickers: ['ADRO', 'PTBA', 'BBTN'], aliases: [
  { alias: 'bara', ticker: 'ADRO', weight: 1 }, { alias: 'bara', ticker: 'PTBA', weight: 1 }, { alias: 'adaro', ticker: 'ADRO', weight: 1 },
] });
it.each<Record<string, string>>([{}, { bara: 'PTBA' }])('continues with empty or partial confirmation while preserving known stocks: %j', async selections => {
  const userSelections = tickerSelections(choices, selections);
  expect(userSelections).toContainEqual({ surface: 'Adarro', ticker: null });
  const result = await normalizeText('BBTN bara Adarro', { directory, userSelections });
  expect(result.status).toBe('ready');
  expect(result.entities.map(entity => entity.ticker)).toEqual(selections.bara ? ['BBTN', 'PTBA'] : ['BBTN']);
});
it('deduplicates repeated mention casing without discarding the chosen stock', () => {
  expect(tickerSelections([...choices, { ...choices[0]!, surface: 'BARA' }], { BARA: 'PTBA' }))
    .toEqual([{ surface: 'bara', ticker: 'PTBA' }, { surface: 'Adarro', ticker: null }]);
});
