import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const marker='.local/crm-review-records.json',origin='http://127.0.0.1:5173';
let keep=false;
function child(args){const result=spawnSync(process.execPath,['scripts/verify-crm.mjs',...args],{encoding:'utf8',windowsHide:true});if(result.stdout)process.stdout.write(result.stdout);if(result.status!==0)throw Error(result.stderr||'CRM checks failed.');}
async function call(path,{cookie,body,expected=200}={}){const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,...cookie?{Cookie:cookie}:{},...body?{'Content-Type':'application/json'}:{}},body:body?JSON.stringify(body):undefined});const data=await response.json();assert.equal(response.status,expected,`${path}: ${JSON.stringify(data)}`);return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
try{
  child(['--keep']);let records=JSON.parse(readFileSync(marker,'utf8'));
  const admin=records.accounts.find(account=>account.email.includes('-admin-')),customer=records.accounts.find(account=>account.email.includes('-customer-'));
  const adminSession=await call('/api/auth',{body:{action:'signin',role:'admin',email:admin.email,password:'CrmReview-only-2026!'}}),customerSession=await call('/api/auth',{body:{action:'signin',role:'customer',email:customer.email,password:'CrmReview-only-2026!'}});
  const cookie=customerSession.cookie,adminCookie=adminSession.cookie;
  const stamp=Date.now(),otherEmail=`crm-review-other-${stamp}@example.test`;
  const other=await call('/api/auth',{body:{action:'signup',role:'customer',name:'Review Other Customer',email:otherEmail,phone:'9000000002',password:'CrmReview-only-2026!'}});records.accounts.push({id:other.data.user.id,email:otherEmail});writeFileSync(marker,JSON.stringify(records));
  await call('/api/account',{expected:401});await call('/api/settings',{cookie,expected:401});
  const profile=await call('/api/account',{cookie,body:{name:'Review Profile Customer',phone:'9000000003',address:'Synthetic default delivery address',email:'ignored@example.test'}});assert.equal(profile.data.user.email,customer.email);assert.equal((await call('/api/account',{cookie})).data.address,'Synthetic default delivery address');
  const options=(await call('/api/store-options')).data.settings;
  const product=(await call('/api/catalog')).data.products.find(product=>product.id===records.product);
  const shipping=options.freeShippingAbove>0&&product.price>=options.freeShippingAbove?0:options.shippingFee;
  const checkoutId=randomUUID(),body={items:[{product:product.id,size:'M',quantity:1,price:1}],address:'Synthetic Buy now address',paymentMethod:'cod',checkoutId,expectedTotal:product.price+shipping};
  await call('/api/orders',{cookie,body:{...body,expectedTotal:1},expected:409});
  const placed=await call('/api/orders',{cookie,body});records.orders.push(placed.data.order.id);writeFileSync(marker,JSON.stringify(records));
  assert.equal(placed.data.order.paymentStatus,'Unpaid');assert.equal(placed.data.order.accountId,customer.id);assert.equal(placed.data.order.total,product.price+shipping);
  assert.equal((await call('/api/orders',{cookie,body})).data.order.id,placed.data.order.id);
  assert.equal((await call('/api/orders',{cookie:other.cookie})).data.orders.length,0);
  await call('/api/orders',{cookie:other.cookie,body:{action:'cancel',id:placed.data.order.id},expected:404});
  if(options.customerCancellation){await call('/api/orders',{cookie,body:{action:'cancel',id:placed.data.order.id}});await call('/api/orders',{cookie,body:{action:'cancel',id:placed.data.order.id}});}
  console.log('PASS: Profile saving, customer-only order access, Buy now totals and duplicate checkout protection.');
  await call('/api/settings',{cookie:adminCookie,body:{action:'userAccess',accountId:customer.id,freeLimit:0,grantCredits:0,enabled:true}});
  const limited=await call('/api/try-on',{cookie,body:{photo:'data:image/png;base64,AAAA',product:product.id,size:'M',consent:true},expected:429});assert.equal(limited.data.error,'Limit reached');assert.equal(limited.data.code,'LIMIT_REACHED');assert.ok(!/fashn|hugging|gpu|model|backend/i.test(limited.data.error));
  await call('/api/settings',{cookie:adminCookie,body:{action:'userAccess',accountId:customer.id,freeLimit:0,grantCredits:3,enabled:true}});
  if(options.aiEnabled){await call('/api/try-on',{cookie,body:{photo:'data:image/png;base64,AAAA',product:product.id,size:'M',consent:true},expected:400});assert.equal((await call('/api/credits',{cookie})).data.access.walletCredits,3);}
  console.log('PASS: Per-user limits are enforced and invalid previews return reserved credits.');
  const pack=options.creditPacks.find(pack=>pack.enabled);
  if(options.aiEnabled&&options.creditSalesEnabled&&pack){await call('/api/credits',{cookie,body:{action:'purchase',kind:'credits',offerId:pack.id,expectedPrice:pack.price+1},expected:400});const selected=await call('/api/credits',{cookie,body:{action:'purchase',kind:'credits',offerId:pack.id,expectedPrice:pack.price}});assert.equal(selected.data.purchase.status,'Pending');assert.equal(selected.data.access.walletCredits,3);assert.equal((await call('/api/credits',{cookie,body:{action:'purchase',kind:'credits',offerId:pack.id}})).data.purchase.id,selected.data.purchase.id);await call('/api/credits',{cookie:other.cookie,body:{action:'cancelPurchase',id:selected.data.purchase.id},expected:400});await call('/api/credits',{cookie,body:{action:'confirm',id:selected.data.purchase.id},expected:400});await call('/api/settings',{cookie:adminCookie,body:{action:'purchase',id:selected.data.purchase.id,decision:'confirm'}});await call('/api/settings',{cookie:adminCookie,body:{action:'purchase',id:selected.data.purchase.id,decision:'confirm'}});assert.equal((await call('/api/credits',{cookie})).data.access.walletCredits,3+pack.credits);console.log('PASS: Credit packs require admin confirmation and cannot be activated twice.');}
  const plan=options.subscriptionPlans.find(plan=>plan.enabled);
  if(options.aiEnabled&&options.subscriptionSalesEnabled&&plan){const selected=await call('/api/credits',{cookie,body:{action:'purchase',kind:'subscription',offerId:plan.id,expectedPrice:plan.price}});assert.equal(selected.data.purchase.status,'Pending');await call('/api/settings',{cookie:adminCookie,body:{action:'purchase',id:selected.data.purchase.id,decision:'confirm'}});const active=(await call('/api/credits',{cookie})).data.access;assert.equal(active.subscriptionCredits,plan.credits);assert.ok(active.subscriptionUntil>Date.now());const ended=await call('/api/credits',{cookie,body:{action:'endSubscription'}});assert.equal(ended.data.access.ending,true);assert.equal(ended.data.access.subscriptionUntil,active.subscriptionUntil);console.log('PASS: Plan activation and ending at expiry preserve the paid access period.');}
  await call('/api/settings',{cookie:adminCookie,body:{action:'userAccess',accountId:other.data.user.id,freeLimit:0,grantCredits:0,enabled:true}});
  keep=process.argv.includes('--keep');if(keep)console.log(JSON.stringify({customer:customer.email,other:otherEmail,profile:'Review Profile Customer',order:placed.data.order.id}));
}finally{if(!keep&&existsSync(marker))child(['--cleanup']);}
