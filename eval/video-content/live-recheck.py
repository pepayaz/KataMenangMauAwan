"""Recheck real video transcripts through the real application; explicit paid-test opt in."""
import argparse,json
from pathlib import Path
from run import call,frames,summarize
p=argparse.ArgumentParser();p.add_argument('--execute',action='store_true');p.add_argument('--base',default='http://localhost:3022');args=p.parse_args()
if not args.execute:p.error('Explicit --execute required for paid LLM testing.')
source=json.loads(Path('docs/measurements/video-content-live-fixed-2026-10-08.json').read_text(encoding='utf8'))
out={'base':args.base,'method':'Fresh UNVR video read; other successful video transcripts rechecked unchanged through actual Gemini extraction and Sectors verification. No fixtures or manual transcript corrections.','cases':[]}
for old in source['cases']:
 if old['input']['body'].get('status')!='ready':continue
 print('START '+old['id'],flush=True)
 case={'id':old['id'],'url':old['url'],'input':old['input'],'inputReused':True}
 if old['id']=='unvr-news':
  inp=call(args.base,'/api/input',{'url':old['url']});case['input']={'httpStatus':inp['status'],'seconds':inp['seconds'],'body':json.loads(inp['raw'])};case['inputReused']=False
 body=case['input']['body']
 if body.get('status')=='ready':
  response=call(args.base,'/api/check',{'text':body['rawText'],'url':old['url'],'source':body.get('source','paste')});case['check']={'httpStatus':response['status'],'seconds':response['seconds'],'frames':frames(response['raw'])}
 else:case['failure']='INPUT_NOT_READY'
 out['cases'].append(case);Path('docs/measurements/video-content-live-final-2026-10-08.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps(summarize(case)),flush=True)
