import { verdictLabels, verdictTone, formatEvidence, type HistoryItem } from '../lib/check-view';

export default function CheckReport({ item }: { item: HistoryItem }) {
  const result = item.result;
  return <>
    <p>{item.demo ? 'Demo fixture offline · bukan data pasar terkini' : 'Hasil pemeriksaan backend · mode cache_only'} · {result.creditsUsed} kredit · {result.verdicts.length} klaim</p>
    {!result.verdicts.length && <p role="status">Belum ada rapor klaim. Lihat jejak pemeriksaan untuk pilihan saham, ekstraksi, atau data yang belum tersedia.</p>}
    {result.verdicts.map(verdict => {
      const claim = result.claims.find(claim => claim.claimId === verdict.claimId);
      const evidence = result.evidence.filter(evidence => verdict.evidenceIds.includes(evidence.evidenceId));
      return <article className="report-card" key={verdict.claimId}>
        <div className="report-main">
          <span className={`verdict ${verdictTone[verdict.verdict]}`}><span className="status-dot" />{verdictLabels[verdict.verdict]}</span>
          <h2>{claim?.ticker} · {claim?.type}</h2><blockquote>“{item.text}”</blockquote>
          <p>{verdict.explanation}</p>
          {verdict.missingContext.map(context => <div className="context-finding" key={context.hypId}>
            <div><span>{context.hypId}</span><p>{context.summary}</p></div>
          </div>)}
        </div>
        <div className="report-evidence"><h3>Angka dan bukti pembanding</h3>
          {verdict.computed && <p>Nilai terhitung: <strong>{formatEvidence(verdict.computed)}</strong></p>}
          {!evidence.length && <p>Belum ada evidence numerik yang memadai.</p>}
          <div className="metric-list">{evidence.map(evidence => <div className="metric" key={evidence.evidenceId}>
            <span>{evidence.label}</span><strong>{formatEvidence(evidence)}</strong>
          </div>)}</div>
          <details><summary>Telusuri sumber dan rumus</summary>{evidence.map(evidence => <div className="source-record" key={evidence.evidenceId}>
            <strong>{evidence.tool}</strong><p>{evidence.cached ? 'Cache' : 'Pengambilan data'} · {evidence.fetchedAt} · {evidence.credits} kredit</p>
            <pre>{JSON.stringify(evidence.params, null, 2)}</pre>
          </div>)}</details>
        </div>
      </article>;
    })}
  </>;
}
