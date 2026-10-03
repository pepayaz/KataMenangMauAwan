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
