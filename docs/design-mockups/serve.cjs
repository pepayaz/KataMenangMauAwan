const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.png':'image/png' };
const allowed = new Set(['index.html','mockups.css','mockups.js','fonts/source-sans-3.ttf','fonts/barlow-semi-condensed-600.ttf']);
http.createServer((req,res)=>{
  const url = new URL(req.url,'http://127.0.0.1');
  const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if(!allowed.has(relative)){res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(root,relative),(err,data)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(relative)],'Cache-Control':'no-store'});res.end(data);
  });
}).listen(3012,'127.0.0.1',()=>process.stdout.write('Design mockups: http://127.0.0.1:3012\n'));
