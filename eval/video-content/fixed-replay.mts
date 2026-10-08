// Replay actual recorded extraction; use real Sectors through its client, no paid LLM requests.
import { readFile, writeFile } from 'node:fs/promises';
import { createSectorsClient } from '../../packages/sectors/src/index.js';
import { LlmAdapter, LlmError, runCheck, normalizeText, createFixtureTickerDirectory, type ExtractedClaim } from '../../packages/agent/src/index.js';
import { extractNumbers, type TraceEvent } from '../../packages/shared/src/index.js';
import { loadAliases } from '../../apps/web/lib/aliases.js';
if (!process.argv.includes('--execute')) throw new Error('Pass --execute to authorize bounded Sectors replay.');
const original=JSON.parse(await readFile('docs/measurements/video-content-audit-2026-10-08.json','utf8'));
const aliases=await loadAliases(null);
const directory=createFixtureTickerDirectory({tickers:[...new Set(aliases.map(a=>a.ticker))],aliases});
const out=[];
for(const item of original.cases.filter((c:{id:string})=>['bbtn-h1','unvr-news','dividend-yield','financial-quality'].includes(c.id))){
 const text=item.input.body.rawText;
 const normalized=await normalizeText(text,{directory});
 const old=item.check.frames.find((f:{event:string})=>f.event==='result').data;
 if(!old.claims.length){out.push({id:item.id,method:'Real transcript normalization with updated official directory; no recorded extraction available',normalization:normalized});continue;}
 const candidates:ExtractedClaim[]=old.claims.map((claim:any)=>{
  const quote=normalized.text.slice(claim.span[0],claim.span[1]);
  const num=extractNumbers(quote).find(n=>!n.ambiguous && (n.unit===claim.asserted.unit || n.unit===null && claim.asserted.unit==='x') && (Math.abs(n.unit==='%' || claim.asserted.unit==='x'?n.value:n.normalized)===Math.abs(claim.asserted.value)));
  return {quote,span:{start:claim.span[0],end:claim.span[1]},tickers:[claim.ticker],type:claim.type,inScope:claim.inScope,asserted:{...claim.asserted,value:num?.value??null,unit:num?.unit??null,period:claim.asserted.period??null,window:claim.asserted.window??null}};
 });
 const llm=new LlmAdapter({env:{LLM_PROVIDER:'mock',LLM_MODEL:'recorded-extraction-replay'},provider:{name:'mock',async complete(request){
  if(request.format.name==='extracted_claims')return {claims:candidates};
  if(request.format.name==='context_hypotheses')return {hypotheses:[]};
  throw new LlmError('QUOTA');
 }}});
 const frames:TraceEvent[]=[];
 const result=await runCheck({checkId:old.checkId,source:'paste',rawText:text,url:item.url,createdAt:new Date().toISOString()},{directory,llm,client:createSectorsClient({config:{mode:'live'}}).client,flags:{earnings_growth:true}},frame=>{frames.push(frame)});
 out.push({id:item.id,method:'Recorded original extraction revalidated against fixed code, real Sectors; explanation fallback; no new LLM extraction/video test',result,frames});
 console.log(JSON.stringify({id:item.id,claims:result.claims.length,evidence:result.evidence.length,credits:result.creditsUsed,verdicts:result.verdicts.map(v=>v.verdict)}));
}
await writeFile('docs/measurements/video-content-fixed-replay-2026-10-08.json',JSON.stringify(out,null,2)+'\n');
