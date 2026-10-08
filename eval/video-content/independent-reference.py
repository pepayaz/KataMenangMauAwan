"""Independent arithmetic from raw cached Sectors responses, without verifier imports."""
import json
from pathlib import Path
src=json.loads(Path('docs/measurements/video-content-sources-2026-10-08.json').read_text(encoding='utf-8'))
rows=next(x['entry']['response'] for x in src if x['entry']['endpoint']=='fetchQuarterlyFinancials' and x['entry']['params']['symbol']=='BBTN')
bydate={r['date']:r for r in rows}
def path(row,field):
    for key in field.split('.'): row=row[key]
    return row
reference={}
for field in ['earnings','financials_sector_metrics.interest_income','provision']:
    current=sum(path(bydate[d],field) for d in ['2026-03-31','2026-06-30'])
    base=sum(path(bydate[d],field) for d in ['2025-03-31','2025-06-30'])
    reference[field]={'current':current,'base':base,'growthPercent':(current-base)/base*100}
report=json.loads(Path('docs/measurements/video-content-audit-2026-10-08.json').read_text(encoding='utf-8'))
checks=[]
for case in report['cases']:
    result=next((f['data'] for f in case.get('check',{}).get('frames',[]) if f['event']=='result'),{})
    verdicts={v['claimId']:v for v in result.get('verdicts',[])}
    for frame in case.get('check',{}).get('frames',[]):
        if frame['event']!='trace' or frame['data'].get('stage')!='verify': continue
        data=frame['data'].get('data',{}); cov=data.get('coverage',{}); field=cov.get('field')
        if cov.get('status')!='CHECKED' or field not in reference: continue
        v=verdicts[data['claimId']]; computed=v.get('computed',{})
        expected=reference[field]['growthPercent'] if cov.get('formula')=='(current - base) / base * 100' else reference[field]['current']
        actual=computed.get('value'); actual=actual*100 if computed.get('unit')=='%' else actual
        delta=None if actual is None else abs(actual-expected)
        checks.append({'case':case['id'],'claimId':data['claimId'],'field':field,'expected':expected,'actual':actual,'difference':delta,'pass':delta is not None and delta <= (0.0051 if computed.get('unit')=='%' else 1)})
unvr=next(x['entry']['response']['dividend'] for x in src if x['entry']['params'].get('symbol')=='UNVR' and x['entry']['params'].get('sections')==['dividend'])
unvr_reference={'amounts2025':[x['total'] for x in unvr['historical_dividends']['2025']['breakdown']],'interim87Present':any(x['total']==87 for x in unvr['historical_dividends']['2025']['breakdown']),'dateCaution':'Cached date 2025-12-15 must not be labeled payment date; issuer confirms payment on 2025-12-30.'}
out={'unvrDividend':unvr_reference,'method':'Independent Python sum and growth formula over exact raw Sectors cache rows; no application verifier or computed evidence used as the reference. This tests arithmetic, not video transcription fidelity or semantic period assignment.','reference':reference,'comparisons':checks}
Path('docs/measurements/video-content-independent-reference-2026-10-08.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(out,ensure_ascii=False))
