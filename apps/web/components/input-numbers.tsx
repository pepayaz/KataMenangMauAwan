'use client';
import { useState } from 'react';
import { ScanText } from 'lucide-react';
import { extractNumbers } from '../../../packages/shared/src/number-id';

/** Navigation aids for reviewing input, not verified financial data. Spans stay UTF-16. */
export default function InputNumbers({ text, disabled, onSelect }: { text: string; disabled: boolean; onSelect: (span: [number, number]) => void }) {
  const [expanded, setExpanded] = useState(false);
  const numbers = extractNumbers(text);
  if (!numbers.length) return null;
  return <div className="input-numbers"><span><ScanText size={15} />Angka di teks</span>
    <div>{(expanded ? numbers : numbers.slice(0, 6)).map(number => <button type="button" disabled={disabled} key={`${number.span[0]}-${number.span[1]}`}
      className={number.ambiguous ? 'is-ambiguous' : ''} onClick={() => onSelect(number.span)}
      aria-label={`Tinjau angka ${number.raw}${number.ambiguous ? ', format ambigu' : ''}`}>{number.raw}</button>)}
      {numbers.length > 6 && <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Ringkas' : `+${numbers.length - 6}`}</button>}
    </div>
  </div>;
}
