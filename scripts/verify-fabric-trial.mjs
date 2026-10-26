import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {databaseRuntime} from './database-runtime.mjs';
const load=await databaseRuntime(),database=await load('database');
const marker='.local/fabric-trial-review.json',origin='http://localhost:5176';
let server;
async function start(enabled){
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','5176'],{cwd:process.cwd(),windowsHide:true,env:{...process.env,APP_ORIGIN:'',VERCEL:'0',FABRIC_TRIAL_ENABLED:String(enabled)},stdio:['ignore','pipe','pipe']});
  let exited=false;server.once('exit',()=>{exited=true;});const end=Date.now()+30000;
  while(Date.now()<end&&!exited){try{if((await fetch(origin,{signal:AbortSignal.timeout(2000)})).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}throw Error('Production trial server did not start.');
}
async function stop(){if(!server)return;const child=server;server=undefined;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
async function cleanup(){
  if(!existsSync(marker))return;const saved=JSON.parse(readFileSync(marker,'utf8'));for(const account of saved.accounts)assert.match(account.email,/^fabric-review-(admin|customer)-\d+@example\.test$/);
  const d=await database.openDatabase();try{await d.exec('BEGIN IMMEDIATE');const row=await d.prepare('SELECT data FROM shop WHERE id=1').get();if(row){const shop=JSON.parse(row.data);shop.customers=shop.customers.filter(item=>!saved.accounts.some(account=>account.id===item.id));await d.prepare('UPDATE shop SET data=?,revision=revision+1 WHERE id=1').run(JSON.stringify(shop));}
    for(const account of saved.accounts){const actual=await d.prepare('SELECT email FROM accounts WHERE id=?').get(account.id);if(actual)assert.equal(actual.email,account.email);for(const table of ['sessions','customer_profiles','customer_access','preview_usage','ai_purchases'])await d.prepare('DELETE FROM '+table+' WHERE account_id=?').run(account.id);await d.prepare('DELETE FROM accounts WHERE id=? AND email=?').run(account.id,account.email);}
    await d.exec('COMMIT');unlinkSync(marker);
  }catch(error){await d.exec('ROLLBACK').catch(()=>{});throw error;}finally{d.close();}
}
async function call(path,{cookie,body}={}){return fetch(origin+path,{method:body?'POST':'GET',redirect:'manual',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
try{
  if(process.argv.includes('--cleanup'))await cleanup();
  else{
    if(existsSync(marker))throw Error('A fabric trial check is already active. Run --cleanup first.');
    await start(true);const stamp=Date.now(),saved={accounts:[]};writeFileSync(marker,JSON.stringify(saved));
    async function account(role){const email=`fabric-review-${role}-${stamp}@example.test`;const response=await call('/api/auth',{body:{action:'signup',role,email,name:'Fabric review '+role,phone:'9000000033',password:'Fabric-review-only-2026!'}});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));saved.accounts.push({id:data.user.id,email});writeFileSync(marker,JSON.stringify(saved));return response.headers.get('set-cookie').split(';')[0];}
    const admin=await account('admin'),customer=await account('customer');
    assert.equal((await call('/api/fabric-trial/access')).status,404);
    assert.equal((await call('/api/fabric-trial/access',{cookie:customer})).status,404);
    const allowed=await call('/api/fabric-trial/access',{cookie:admin});assert.equal(allowed.status,200);assert.equal((await allowed.json()).enabled,true);
    for(const path of ['/crm/fabric-trial','/crm/fabric-trial/checks']){for(const cookie of [undefined,customer]){const response=await call(path,{cookie});assert.ok([307,308].includes(response.status),path+' must redirect unauthorised visitors');assert.ok(response.headers.get('location').includes('/crm/login'));}const response=await call(path,{cookie:admin});assert.equal(response.status,200);assert.ok((await response.text()).includes(path.endsWith('checks')?'Fabric preview browser checks':'A swatch. A silhouette.'));}
    assert.equal((await call('/api/studio',{cookie:admin})).status,200);assert.equal((await call('/api/catalog')).status,200);
    console.log('PASS: Trial and browser-check pages require an admin session; existing CRM and catalogue still respond.');
    await stop();await start(false);
    assert.equal((await call('/api/fabric-trial/access',{cookie:admin})).status,404);
    assert.equal((await call('/crm/fabric-trial',{cookie:admin})).status,404);
    assert.equal((await call('/crm/fabric-trial/checks',{cookie:admin})).status,404);
    console.log('PASS: Turning the feature flag off hides every trial entry point, including from admins.');
  }
}finally{await stop();await cleanup();await database.closeDatabasePool();}
