import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {databaseRuntime} from './database-runtime.mjs';
const load=await databaseRuntime(),database=await load('database');
const marker='.local/hosted-auth-review.json';
const site='https://boutique-roan-kappa.vercel.app',base='http://127.0.0.1:5175';
let server;
async function cleanup(){
  if(!existsSync(marker))return;
  const saved=JSON.parse(readFileSync(marker,'utf8'));assert.match(saved.email,/^hosted-review-\d+@example\.test$/);
  const d=await database.openDatabase();
  try{await d.exec('BEGIN IMMEDIATE');const account=await d.prepare('SELECT id FROM accounts WHERE email=?').get(saved.email);
    if(account){const row=await d.prepare('SELECT data FROM shop WHERE id=1').get();if(row){const shop=JSON.parse(row.data);shop.customers=shop.customers.filter(item=>item.id!==account.id);await d.prepare('UPDATE shop SET data=?,revision=revision+1 WHERE id=1').run(JSON.stringify(shop));}
      for(const table of ['sessions','customer_profiles','customer_access','preview_usage','ai_purchases'])await d.prepare('DELETE FROM '+table+' WHERE account_id=?').run(account.id);
      await d.prepare('DELETE FROM accounts WHERE id=? AND email=?').run(account.id,saved.email);
    }await d.exec('COMMIT');unlinkSync(marker);
  }catch(error){await d.exec('ROLLBACK').catch(()=>{});throw error;}finally{d.close();}
}
try{
  if(process.argv.includes('--cleanup'))await cleanup();
  else{
    if(existsSync(marker))throw Error('A hosted auth test is active. Run --cleanup first.');
    server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','5175'],{cwd:process.cwd(),windowsHide:true,env:{...process.env,VERCEL:'1',APP_ORIGIN:site,VERCEL_PROJECT_PRODUCTION_URL:new URL(site).host},stdio:['ignore','pipe','pipe']});
    let exited=false;server.once('exit',()=>{exited=true;});
    let ready=false;const end=Date.now()+30000;
    while(Date.now()<end&&!exited){try{if((await fetch(base,{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}assert.ok(ready,'Hosted-mode production server did not start.');
    async function call(path,{body,cookie,origin=site,expected=200}={}){
      const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Host:new URL(site).host,'X-Forwarded-Host':new URL(site).host,'X-Forwarded-Proto':'https',...(origin?{Origin:origin}:{}),...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
      const data=await response.json();assert.equal(response.status,expected,path+': '+JSON.stringify(data));return {data,cookie:response.headers.get('set-cookie')};
    }
    const email='hosted-review-'+Date.now()+'@example.test',password='Hosted-review-only-2026!';
    writeFileSync(marker,JSON.stringify({email}));
    const body={action:'signup',role:'customer',name:'Hosted review',email,phone:'9000000022',password};
    await call('/api/auth',{body,origin:'https://evil.example',expected:403});
    await call('/api/auth',{body,origin:null,expected:403});
    await call('/api/auth',{body:{...body,role:'admin'},expected:403});
    const created=await call('/api/auth',{body});assert.equal(created.data.user.email,email);assert.match(created.cookie,/; Secure/);assert.match(created.cookie,/; HttpOnly/);
    const session=await call('/api/auth',{body:{action:'signin',role:'customer',email,password}});assert.equal(session.data.user.id,created.data.user.id);assert.match(session.cookie,/; Secure/);
    const cookie=session.cookie.split(';')[0];const profile=await call('/api/account',{cookie});assert.equal(profile.data.user.id,created.data.user.id);
    await call('/api/settings',{cookie,expected:401});await call('/api/catalog');
    await call('/api/auth',{body:{action:'signout',role:'customer'},cookie});assert.equal((await call('/api/auth?role=customer',{cookie})).data.user,null);
    const html=await (await fetch(base)).text();assert.ok(html.includes('<svg class="brand-mark"'));assert.ok(html.includes('/favicon.svg?v=aarini-2'));
    for(const path of ['/aarini-mark.svg','/favicon.svg','/favicon-32.png'])assert.equal((await fetch(base+path)).status,200,path);
    console.log('PASS: Hosted customer signup, signin, secure cookies, profile, signout and logo assets.');
    console.log('PASS: Cross-site writes and anonymous studio-account creation remain blocked.');
  }
}finally{server?.kill();await cleanup();await database.closeDatabasePool();}
