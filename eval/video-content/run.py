"""Finite, opt-in end-to-end video audit against a running Cek Dulu server.
No provider credentials are read. Calls only the application's public input/check routes.
"""
import argparse, json, time, urllib.request, urllib.error
from pathlib import Path
from datetime import datetime, timezone

CASES = [
    ('unvr-news', 'UNVR: berita dividen dan laba 2025', 'https://www.tiktok.com/@idxchannel/video/7581460698346097936'),
    ('adro-dividend-news', 'ADRO: dividen tunai 2024', 'https://www.dailymotion.com/video/x8yiroa'),
    ('bbtn-h1', 'BBTN: laporan semester I 2026', 'https://www.tiktok.com/@olivia.louise04/video/7664241348140272917'),
    ('dividend-yield', 'Saham nonbank: dividend yield', 'https://www.tiktok.com/@olivia.louise04/video/7663503114313534740'),
    ('valuation', 'Nilai wajar berbasis dividen', 'https://www.tiktok.com/@olivia.louise04/video/7670891057772580116'),
    ('financial-quality', 'Kualitas perusahaan dan dividen', 'https://www.tiktok.com/@olivia.louise04/video/7669806798244744469'),
    ('bbni-profit', 'BBNI: laba rekor dan konteks', 'https://vt.tiktok.com/ZS8AqxFaP/'),
    ('bbca-dividend-youtube', 'BBCA: dividen tahun buku 2025', 'https://www.youtube.com/watch?v=Ru1jbrcX5Lc'),
]

def call(base, route, body=None, timeout=360):
    req = urllib.request.Request(base+route, data=None if body is None else json.dumps(body).encode(), headers={'Content-Type':'application/json'})
    start = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status, headers, raw = response.status, dict(response.headers), response.read().decode('utf-8')
    except urllib.error.HTTPError as error:
        status, headers, raw = error.code, dict(error.headers), error.read().decode('utf-8')
    return {'status':status,'seconds':round(time.monotonic()-start,3),'headers':headers,'raw':raw}

def frames(raw):
    out=[]
    for block in raw.replace('\r\n','\n').split('\n\n'):
        event='message'; data=[]
        for line in block.splitlines():
            if line.startswith('event:'): event=line[6:].strip()
            if line.startswith('data:'): data.append(line[5:].strip())
        if data:
            try: out.append({'event':event,'data':json.loads('\n'.join(data))})
            except json.JSONDecodeError: out.append({'event':event,'data':'INVALID_JSON'})
    return out

def summarize(case):
    fs=case.get('check',{}).get('frames',[])
    result=next((f['data'] for f in fs if f['event']=='result'),{})
    verdicts=result.get('verdicts',[])
    return {'id':case['id'],'input':case.get('input',{}).get('body',{}).get('status'),
            'inputSeconds':case.get('input',{}).get('seconds'),'checkSeconds':case.get('check',{}).get('seconds'),
            'resultKeys':list(result),'claims':len(result.get('claims',[])),
            'evidence':len(result.get('evidence',[])), 'credits':result.get('creditsUsed'),
            'verdicts':{v:sum(x['verdict']==v for x in verdicts) for v in sorted({x['verdict'] for x in verdicts})},
            'error':case.get('failure')}

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--execute',action='store_true',help='Explicitly authorize paid input/check calls')
    p.add_argument('--base',default='http://localhost:3022')
    p.add_argument('--ids',default=','.join(x[0] for x in CASES))
    p.add_argument('--output',default='docs/measurements/video-content-audit-2026-10-08.json')
    args=p.parse_args()
    if not args.execute: p.error('Use --execute only when paid video/check testing is authorized.')
    dest=Path(args.output); dest.parent.mkdir(parents=True,exist_ok=True)
    report=json.loads(dest.read_text(encoding='utf-8')) if dest.exists() else {'startedAt':datetime.now(timezone.utc).isoformat(),'base':args.base,'cases':[]}
    health=call(args.base,'/api/check'); report['health']=json.loads(health['raw'])
    if report['health'].get('fixtureDemo') or not report['health'].get('llmConfigured'): raise RuntimeError('Real pipeline unavailable')
    ids=args.ids.split(',')
    for cid,title,url in CASES:
        if cid not in ids or any(c['id']==cid for c in report['cases']): continue
        case={'id':cid,'title':title,'url':url,'startedAt':datetime.now(timezone.utc).isoformat(),'transcriptReview':'No manual correction; automatic transcript tested as returned. Independent video fidelity not established.'}
        print('START '+cid,flush=True)
        try:
            inp=call(args.base,'/api/input',{'url':url})
            case['input']={'httpStatus':inp['status'],'seconds':inp['seconds'],'body':json.loads(inp['raw'])}
            body=case['input']['body']
            if inp['status']==200 and body.get('status')=='ready' and body.get('rawText','').strip():
                chk=call(args.base,'/api/check',{'text':body['rawText'],'url':url,'source':body.get('source','paste')})
                case['check']={'httpStatus':chk['status'],'seconds':chk['seconds'],'frames':frames(chk['raw'])}
            else: case['failure']='INPUT_NOT_READY'
        except Exception as exc: case['failure']=type(exc).__name__+': '+str(exc)
        report['cases'].append(case)
        dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(summarize(case),ensure_ascii=False),flush=True)
    print('Saved '+str(dest),flush=True)
if __name__=='__main__': main()
