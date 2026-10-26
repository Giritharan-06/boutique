import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
delete process.env.DATABASE_URL;delete process.env.APP_ORIGIN;delete process.env.VERCEL;
delete process.env.RESEND_API_KEY;delete process.env.PASSWORD_RESET_FROM;delete process.env.PASSWORD_RESET_ORIGIN;
const project=process.cwd(),parent=join(project,'.local');mkdirSync(parent,{recursive:true});
const temporary=mkdtempSync(join(parent,'password-tests-'));
for(const name of ['auth','database','security','password-reset']){
  const source=readFileSync(join(project,'lib/local/'+name+'.ts'),'utf8').replaceAll("'./database'","'./database.mjs'");
  writeFileSync(join(temporary,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
}
const route=readFileSync(join(project,'app/api/auth/password-reset/route.ts'),'utf8').replace("'../../../../lib/local/security'","'./security.mjs'").replace("'../../../../lib/local/password-reset'","'./password-reset.mjs'");
writeFileSync(join(temporary,'route.mjs'),ts.transpileModule(route,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
process.chdir(temporary);
const auth=await import(pathToFileURL(join(temporary,'auth.mjs')).href),db=await import(pathToFileURL(join(temporary,'database.mjs')).href),reset=await import(pathToFileURL(join(temporary,'password-reset.mjs')).href),api=await import(pathToFileURL(join(temporary,'route.mjs')).href);
process.chdir(project);
after(()=>{assert.ok(resolve(temporary).startsWith(resolve(parent)+sep));rmSync(temporary,{recursive:true,force:true});});
let serial=0;
const make=role=>auth.createAccount({name:'Reset test',email:`reset-${++serial}@example.test`,phone:'9000000000',password:'Original-test-password',role});
const cookie=(token,role)=>new Request('http://localhost',{headers:{cookie:auth.sessionCookie(token,role)}});
const capture=async(account,role)=>{let url;await reset.requestPasswordReset(account.email,role,'https://boutique.example',async(email,link)=>{assert.equal(email,account.email);url=link;});return new URLSearchParams(new URL(url).hash.slice(1)).get('token');};
test('customer recovery is single-use, changes the password and revokes existing sessions',async()=>{
  const {account,token:session}=await make('customer');const token=await capture(account,'customer');
  assert.equal(await auth.getAuthUser(cookie(token,'customer'),'customer'),null);
  await reset.completePasswordReset(token,'Replacement-password-2026','customer');
  await assert.rejects(()=>auth.signIn(account.email,'Original-test-password','customer'));
  assert.equal((await auth.signIn(account.email,'Replacement-password-2026','customer')).account.id,account.id);
  assert.equal(await auth.getAuthUser(cookie(session,'customer'),'customer'),null);
  await assert.rejects(()=>reset.completePasswordReset(token,'Another-password-2026','customer'),/invalid or has expired/);
});
test('admin recovery is role-bound and rejects expired links and weak passwords',async()=>{
  const {account}=await make('admin'),token=await capture(account,'admin');
  await assert.rejects(()=>reset.completePasswordReset(token,'Replacement-password-2026','customer'),/invalid or has expired/);
  await assert.rejects(()=>reset.completePasswordReset(token,'short','admin'),/between 10 and 128/);
  await reset.completePasswordReset(token,'Replacement-password-2026','admin');
  assert.equal((await auth.signIn(account.email,'Replacement-password-2026','admin')).account.role,'admin');
  const other=await make('customer'),expired=await capture(other.account,'customer');
  const d=await db.openDatabase();try{await d.prepare('UPDATE sessions SET expires_at=? WHERE account_id=?').run(Date.now()-1,other.account.id);}finally{d.close();}
  await assert.rejects(()=>reset.completePasswordReset(expired,'Replacement-password-2026','customer'),/invalid or has expired/);
});
test('unknown accounts and wrong roles receive the same answer; repeated emails are throttled',async()=>{
  const {account}=await make('customer');let sent=0;const send=async()=>{sent++;};
  const known=await reset.requestPasswordReset(account.email,'customer','https://boutique.example',send);
  assert.equal(await reset.requestPasswordReset('unknown@example.test','customer','https://boutique.example',send),known);
  assert.equal(await reset.requestPasswordReset(account.email,'admin','https://boutique.example',send),known);
  assert.equal(await reset.requestPasswordReset(account.email,'customer','https://boutique.example',send),known);assert.equal(sent,1);
});
test('failed delivery removes the recovery token and concurrent redemption succeeds only once',async()=>{
  const {account}=await make('customer');await assert.rejects(()=>reset.requestPasswordReset(account.email,'customer','https://boutique.example',async()=>{throw Error('mail failed');}),/temporarily unavailable/);
  const d=await db.openDatabase();try{assert.equal((await d.prepare("SELECT token_hash FROM sessions WHERE account_id=? AND token_hash LIKE 'reset:%'").all(account.id)).length,0);}finally{d.close();}
  const token=await capture(account,'customer');const attempts=await Promise.allSettled([reset.completePasswordReset(token,'Concurrent-password-one','customer'),reset.completePasswordReset(token,'Concurrent-password-two','customer')]);
  assert.equal(attempts.filter(item=>item.status==='fulfilled').length,1);
});
test('reset API rejects cross-origin writes and honestly reports missing email setup',async()=>{
  const request=(origin,body)=>new Request('http://localhost/api/auth/password-reset',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await api.POST(request('https://evil.example',{action:'request',role:'customer',email:'test@example.test'}))).status,403);
  const response=await api.POST(request('http://localhost',{action:'request',role:'customer',email:'test@example.test'}));assert.equal(response.status,503);assert.equal((await response.json()).error,reset.resetUnavailable);
  assert.equal((await api.POST(request('http://localhost',{action:'reset',role:'admin',token:'invalid',password:'Replacement-password'}))).status,400);
});
