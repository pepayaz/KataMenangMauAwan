"""Independent arithmetic and verdict checks against cached raw Sectors source snapshots."""
import json,math
from pathlib import Path
final=json.loads(Path('docs/measurements/video-content-live-final-2026-10-08.json').read_text(encoding='utf8'))
sources=json.loads(Path('docs/measurements/video-content-live-final-sources-2026-10-08.json').read_text(encoding='utf8'))
checks=[]
def add(name,passed,actual=None):checks.append({'name':name,'pass':bool(passed),'actual':actual})
def result(cid):return next(f['data'] for c in final['cases'] if c['id']==cid for f in c['check']['frames'] if f['event']=='result')
def source(symbol,endpoint,section=None):
 return next(x['entry']['response'] for x in sources if x['entry']['endpoint']==endpoint and x['entry']['params']['symbol']==symbol and (not section or section in x['entry']['params'].get('sections',[])))
def value(res,ticker,metric):
 return next((c,v) for c,v in zip(res['claims'],res['verdicts']) if c['ticker']==ticker and c['asserted']['metric']==metric)
u=result('unvr-news');rows=source('UNVR','fetchQuarterlyFinancials')
def total(year,field):return sum(r[field] for r in rows if r['date'] in [f'{year}-03-31',f'{year}-06-30',f'{year}-09-30'])
for metric,field in [('laba bersih','earnings'),('penjualan bersih','revenue')]:
 actual=total(2025,field);_,v=value(u,'UNVR',metric);add('UNVR '+metric,v['computed']['value']==actual and v['verdict']=='supported',actual)
 growth=(actual/total(2024,field)-1)*100;_,v=value(u,'UNVR','pertumbuhan '+metric);add('UNVR pertumbuhan '+metric,math.isclose(v['computed']['value'],round(growth,2)/100,abs_tol=1e-10) and v['verdict']=='supported',growth)
_,v=value(u,'UNVR','penjualan segmen kebutuhan rumah tangga dan perawatan tubuh');add('Segment revenue is not replaced by company revenue',v['verdict']=='unverifiable' and 'computed' not in v)
b=result('bbtn-h1');rows=source('BBTN','fetchQuarterlyFinancials')
profit=sum(r['earnings'] for r in rows if r['date'] in ['2026-03-31','2026-06-30']);_,v=value(b,'BBTN','laba bersih');add('BBTN H1 nominal profit',v['computed']['value']==profit and v['verdict']=='supported',profit)
f=result('financial-quality')
for ticker in ['GJTL','AUTO','BJTM']:
 d=source(ticker,'fetchCompanyReport','dividend')['dividend']
 for metric,field,threshold,op in [('dividend yield','yield_ttm',0.06,'gt'),('dividend payout ratio','payout_ratio',0.6,'lt')]:
  _,v=value(f,ticker,metric);actual=d.get(field)
  if actual is None:add(ticker+' missing '+field,v['verdict']=='unverifiable' and 'computed' not in v);continue
  expected=actual>threshold if op=='gt' else actual<threshold
  add(ticker+' '+field+' bound',(v['verdict'] in ['supported','misleading'])==expected and v['computed']['value']==actual,actual)
 rows_v=source(ticker,'fetchCompanyReport','valuation')['valuation']['historical_valuation'];actual=max((r for r in rows_v if isinstance(r.get('pb'),(int,float))),key=lambda r:r['year'])['pb'];_,v=value(f,ticker,'PBV');add(ticker+' PBV below 1',(v['verdict'] in ['supported','misleading'])==(actual<1) and v['computed']['value']==actual,actual)
add('Final rechecks did not spend new Sectors credits',all(result(c['id'])['creditsUsed']==0 for c in final['cases']))
report={'method':'Independent Python calculation from raw cached source responses, no API calls and no application verifier imports','checks':checks,'pass':all(c['pass'] for c in checks)}
Path('docs/measurements/video-content-live-reference-2026-10-08.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'pass':report['pass']}))
if not report['pass']:raise SystemExit(1)
