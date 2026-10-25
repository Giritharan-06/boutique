import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {databaseRuntime} from './database-runtime.mjs';
const load=await databaseRuntime();
const db=await load('database'),auth=await load('auth'),commerce=await load('commerce');
const marker='.local/postgres-review-records.json';
if(db.databaseMode()!=='postgres')throw Error('This check requires DATABASE_URL.');
async function cleanup(){
  if(!existsSync(marker))return;
  const account=JSON.parse(readFileSync(marker,'utf8'));assert.match(account.email,/^postgres-review-[a-f0-9-]+@example\.test$/);
  const d=await db.openDatabase();
  try{await d.exec('BEGIN IMMEDIATE');const stored=await d.prepare('SELECT email FROM accounts WHERE id=?').get(account.id);if(stored)assert.equal(stored.email,account.email);
    for(const table of ['preview_usage','ai_purchases','customer_access','customer_profiles','sessions'])await d.prepare('DELETE FROM '+table+' WHERE account_id=?').run(account.id);
    await d.prepare('DELETE FROM accounts WHERE id=? AND email=?').run(account.id,account.email);await d.exec('COMMIT');unlinkSync(marker);
  }catch(error){await d.exec('ROLLBACK').catch(()=>{});throw error;}finally{d.close();}
}
try{
  if(process.argv.includes('--cleanup')){await cleanup();}
  else{
    if(existsSync(marker))throw Error('A PostgreSQL check is already active. Use --cleanup first.');
    const email='postgres-review-'+randomUUID()+'@example.test';
    const {account,token}=await auth.createAccount({name:'Postgres review',email,phone:'9000000011',password:'Postgres-review-only-2026!',role:'customer'});writeFileSync(marker,JSON.stringify({id:account.id,email}));
    assert.equal((await auth.getAuthUser(new Request('http://127.0.0.1:5173/',{headers:{Cookie:'aarini_customer_session='+token}}),'customer')).id,account.id);
    const settings=(await commerce.readCommerceSettings()).settings;
    assert.ok(settings.aiEnabled,'Enable previews before testing credits.');
    await commerce.updateUserAccess({accountId:account.id,freeLimit:0,grantCredits:settings.previewCost,enabled:true});
    const ids=Array.from({length:4},()=>randomUUID());
    const attempts=await Promise.allSettled(ids.map(id=>commerce.reservePreview(account.id,id)));
    assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1,JSON.stringify(attempts.map(result=>result.status==='fulfilled'?'reserved':{code:result.reason.code,message:result.reason.message})));
    for(const attempt of attempts.filter(result=>result.status==='rejected'))assert.match(attempt.reason.message,/Limit reached/);
    assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits,0);
    const accepted=ids[attempts.findIndex(result=>result.status==='fulfilled')];
    await Promise.all([commerce.settlePreview(accepted,false),commerce.settlePreview(accepted,false)]);
    assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits,settings.previewCost);
    console.log('PASS: Concurrent PostgreSQL reservations cannot overspend; refunds apply once.');
    const offer=settings.creditPacks.find(pack=>pack.enabled);
    if(settings.creditSalesEnabled&&offer){const purchase=await commerce.createAiPurchase(account.id,'credits',offer.id,offer.price);assert.equal(purchase.accountId,account.id);assert.equal(typeof purchase.createdAt,'number');await Promise.all([commerce.manageAiPurchase(purchase.id,'confirm'),commerce.manageAiPurchase(purchase.id,'confirm')]);assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits,settings.previewCost+offer.credits);console.log('PASS: Concurrent payment confirmations grant credits once; PostgreSQL result types match the UI.');}
  }
}finally{await cleanup();await db.closeDatabasePool();}
