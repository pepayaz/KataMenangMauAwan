"""Two explicit text controls derived from the raw BBTN source reference, not extra video cases."""
import argparse, json
from pathlib import Path
from run import call, frames
p=argparse.ArgumentParser(); p.add_argument('--execute', action='store_true'); args=p.parse_args()
if not args.execute: p.error('Use --execute only for explicitly authorized paid testing.')
rows=[]
for name,text,expected in [
 ('matching','BBTN laba bersih Rp2,4 triliun pada semester I 2026. Laba bersih BBTN tumbuh 40,8% YoY pada semester I 2026.',['supported','misleading']),
 ('changed-numbers','BBTN laba bersih Rp5 triliun pada semester I 2026. Laba bersih BBTN tumbuh 90% YoY pada semester I 2026.',['refuted']),
]:
    print('START control '+name,flush=True)
    response=call('http://localhost:3022','/api/check',{'text':text,'source':'paste'})
    fs=frames(response['raw']); result=next((f['data'] for f in fs if f['event']=='result'),{})
    verdicts=result.get('verdicts',[])
    row={'id':name,'text':text,'expectedVerdicts':expected,'httpStatus':response['status'],'seconds':response['seconds'],'frames':fs,
         'pass':len(verdicts)==2 and all(v['verdict'] in expected for v in verdicts)}
    rows.append(row)
    print(json.dumps({'id':name,'pass':row['pass'],'seconds':row['seconds'],'credits':result.get('creditsUsed'),'verdicts':[v['verdict'] for v in verdicts]}),flush=True)
Path('docs/measurements/video-content-controls-2026-10-08.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
