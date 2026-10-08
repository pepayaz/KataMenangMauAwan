import { z } from 'zod';
import type { TraceEvent } from '@cek-dulu/shared/schemas';

const candidateSchema = z.object({ ticker: z.string().regex(/^[A-Z]{4}$/), label: z.string(), score: z.number().min(0).max(1) });
const choicesSchema = z.object({ status: z.literal('needs_user_choice'), choices: z.array(z.object({
  surface: z.string().min(1), reason: z.string(), candidates: z.array(candidateSchema).max(10),
})) });
export type UiTickerChoice = z.infer<typeof choicesSchema>['choices'][number];
/** data TraceEvent bertipe unknown; validasi sebelum menampilkan kontrol pilihan. */
export function readTickerChoices(event: TraceEvent): UiTickerChoice[] {
  if (event.stage !== 'normalize') return [];
  const parsed = choicesSchema.safeParse(event.data);
  return parsed.success ? parsed.data.choices : [];
}

/** Empty confirmation means skip this mention, never guess a ticker. */
export function tickerSelections(choices: readonly UiTickerChoice[], selections: Record<string, string>) {
  const surfaces = [...choices.map(choice => choice.surface), ...Object.keys(selections)];
  const seen = new Set<string>();
  return surfaces.flatMap(surface => {
    const normalized = surface.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    const match = Object.entries(selections).find(([name]) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === normalized);
    return [{ surface, ticker: match?.[1] || null }];
  });
}
