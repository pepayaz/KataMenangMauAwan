import { CircleCheck, CircleHelp, CircleMinus, CircleX, TriangleAlert } from 'lucide-react';
import type { Verdict } from '@cek-dulu/shared/schemas';
import { verdictLabels } from '../lib/check-view';

const icons = { supported: CircleCheck, refuted: CircleX, misleading: TriangleAlert,
  unverifiable: CircleHelp, out_of_scope: CircleMinus };

export default function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const Icon = icons[verdict];
  return <span className={`verdict verdict-${verdict}`}><Icon size={16} aria-hidden="true" />{verdictLabels[verdict]}</span>;
}
