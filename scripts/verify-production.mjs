import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const manifest='.next/routes-manifest.json';
assert.ok(existsSync(manifest),'Build with npm run build first.');
JSON.parse(readFileSync(manifest,'utf8'));
const origin='http://127.0.0.1:5174';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','5174'],{cwd:process.cwd(),windowsHide:true,stdio:['ignore','pipe','pipe']});
let exited=false;server.once('exit',()=>{exited=true;});
try{
  const end=Date.now()+30000;let ready=false;
  while(Date.now()<end&&!exited){try{const response=await fetch(origin,{signal:AbortSignal.timeout(2000)});if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
  assert.ok(ready,'Production server failed to start.');
  for(const path of ['/','/login','/account','/crm','/crm/login']){const response=await fetch(origin+path);assert.equal(response.status,200,path);assert.ok((await response.text()).includes('Aarini'));}
  const catalogue=await fetch(origin+'/api/catalog');assert.equal(catalogue.status,200);const data=await catalogue.json();assert.ok(data.products.length>=40);assert.ok(data.products.every(product=>typeof product.name==='string'));
  assert.equal((await fetch(origin+'/api/studio')).status,401);
  assert.equal((await fetch(origin+'/api/auth?role=customer')).status,200);
  console.log('PASS: Next.js routes manifest, all page routes, PostgreSQL catalogue and protected CRM API.');
}finally{server.kill();}
