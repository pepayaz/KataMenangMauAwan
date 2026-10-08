import {createSectorsClient,cacheKey} from '../../packages/sectors/src/index.js';
import {readFile,writeFile} from 'node:fs/promises';
const report=JSON.parse(await readFile('docs/measurements/video-content-live-final-2026-10-08.json','utf8'));
const {cache}=createSectorsClient({config:{mode:'cache_only'}});const found=new Map<string,unknown>();
for(const c of report.cases)for(const f of c.check?.frames??[])for(const source of f.data?.data?.sourceCalls??[]){
 if(!['received','reused'].includes(source.status))continue;const key=cacheKey(source.tool,source.params);if(!found.has(key))found.set(key,await cache.get(key));
}
const entries=[...found].map(([key,entry])=>({key,entry}));
await writeFile('docs/measurements/video-content-live-final-sources-2026-10-08.json',JSON.stringify(entries,null,2)+'\n');console.log(JSON.stringify({sourceCount:entries.length,missing:entries.filter(x=>!x.entry).length,liveCalls:0}));
