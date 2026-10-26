import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import sharp from 'sharp';
import {fashionRuntime} from '../scripts/fashion-runtime.mjs';
for(const key of ['DATABASE_URL','APP_ORIGIN','VERCEL','HF_TOKEN','AI_STUDIO_GATEWAY_URL','AI_STUDIO_GATEWAY_APPROVED','AI_STUDIO_ALLOW_DEMOS'])delete process.env[key];
process.env.AI_STUDIO_IMAGE_KEY='ab'.repeat(32);process.env.AI_STUDIO_DAILY_LIMIT='100';process.env.AI_FASHION_STUDIO_ENABLED='true';
const project=process.cwd(),parent=join(project,'.local');mkdirSync(parent,{recursive:true});const temp=mkdtempSync(join(parent,'fashion-tests-'));
const load=await fashionRuntime({directory:join(temp,'runtime'),environment:false});process.chdir(temp);
const store=await load('store'),images=await load('images'),jobs=await load('jobs'),model=await load('model'),provider=await load('providers'),auth=await load('auth'),access=await load('access'),database=await load('database');process.chdir(project);
after(()=>{assert.ok(resolve(temp).startsWith(resolve(parent)+sep));rmSync(temp,{recursive:true,force:true});});
const png=await sharp({create:{width:128,height:192,channels:3,background:'#77364e'}}).png().toBuffer();
const uploader=new images.ImageUploadService();
const caps={reference:true,concepts:true,saree:false,analysis:false,segmentation:false,storageReady:true};
let sequence=0;
async function inputs(){const owner='test-owner-'+(++sequence),reference=await uploader.upload(owner,png,'image/png','reference'),person=await uploader.upload(owner,png,'image/png','person');return {owner,reference,person};}
const request=(input,extra={})=>({module:'reference',action:'try-on',sourceKind:'flat-lay',referenceId:input.reference.id,personId:input.person.id,consent:true,idempotency:crypto.randomUUID(),...extra});
function fakeProvider(){let submissions=0;return {get submissions(){return submissions;},async submit(){submissions++;return {provider:'fashn',event:'test-event',endpoint:'try_on'};},async poll(){return {status:'completed',bytes:png};}};}
async function complete(job,owner,p=fakeProvider()){const service=new jobs.AIJobStatusService();while(['queued','running','submitting'].includes(job.status))job=await service.advance(job.id,owner,p);return job;}
test('studio access requires the feature flag and an existing admin session',async()=>{
  const customer=await auth.createAccount({name:'Customer',email:'studio-customer@example.test',phone:'9000000000',password:'Test-password-2026',role:'customer'}),admin=await auth.createAccount({name:'Owner',email:'studio-admin@example.test',password:'Test-password-2026',role:'admin'});
  const req=token=>new Request('http://localhost',{headers:token?{cookie:token}:{}});
  await assert.rejects(()=>access.studioAdmin(req()),e=>e.code==='ADMIN_REQUIRED');
  await assert.rejects(()=>access.studioAdmin(req(auth.sessionCookie(customer.token,'customer'))),e=>e.code==='ADMIN_REQUIRED');
  await assert.rejects(()=>access.studioAdmin(req(auth.sessionCookie(customer.token,'admin'))),e=>e.code==='ADMIN_REQUIRED');
  assert.equal((await access.studioAdmin(req(auth.sessionCookie(admin.token,'admin')))).id,admin.account.id);
  process.env.AI_FASHION_STUDIO_ENABLED='false';await assert.rejects(()=>access.studioAdmin(req(auth.sessionCookie(admin.token,'admin'))),e=>e.status===404);process.env.AI_FASHION_STUDIO_ENABLED='true';
});
test('uploads validate actual image bytes and strip metadata; encrypted assets are owner-only',async()=>{
  const input=await inputs(),item=await store.readAsset(input.reference.id,input.owner);assert.ok(item);assert.equal(await store.readAsset(input.reference.id,'someone-else'),null);
  const d=await database.openDatabase();try{const row=await d.prepare('SELECT data FROM fashion_studio_assets WHERE id=?').get(input.reference.id);assert.notDeepEqual(Buffer.from(row.data),item.bytes);}finally{d.close();}
  await assert.rejects(()=>uploader.upload(input.owner,Buffer.from('<svg/>'),'image/png','reference'),e=>e.code==='INVALID_IMAGE');
  await assert.rejects(()=>uploader.prepare(png,'image/svg+xml'),e=>e.code==='INVALID_IMAGE');
  await assert.rejects(()=>uploader.prepare(Buffer.alloc(3*1024*1024+1),'image/png'),e=>e.code==='IMAGE_SIZE');
  const m=await sharp(item.bytes).metadata();assert.equal(m.exif,undefined);
});
test('reference workflow persists real-provider handles and never exposes them publicly',async()=>{
  const input=await inputs(),created=await jobs.createStudioJob(input.owner,request(input),caps),p=fakeProvider(),service=new jobs.AIJobStatusService();
  const attempts=await Promise.all([service.advance(created.id,input.owner,p),service.advance(created.id,input.owner,p)]);assert.equal(p.submissions,1);
  assert.ok(attempts.every(j=>!('remote' in j)&&!('owner' in j)));
  const result=await complete(created,input.owner,p);assert.equal(result.status,'completed');assert.equal(result.results.length,1);assert.equal(result.results[0].label,'AI try-on preview');
  assert.equal(await service.advance(created.id,'another-owner',p),null);
});
test('fabric workflow requires four generated concepts and binds a selected design to its source',async()=>{
  const input=await inputs();let job=await jobs.createStudioJob(input.owner,request(input,{module:'fabric',action:'concepts',sourceKind:'fabric',designs:['boat','princess','puff','elbow']}),caps);
  job=await complete(job,input.owner);assert.equal(job.results.length,4);assert.ok(job.results.every(r=>r.label==='AI-generated concept'));
  const selected=await jobs.createStudioJob(input.owner,request(input,{module:'fabric',sourceKind:'fabric',conceptJobId:job.id,designId:'puff'}),caps);assert.equal(selected.sourceKind,'flat-lay');assert.equal((await complete(selected,input.owner)).status,'completed');
  await assert.rejects(()=>jobs.createStudioJob(input.owner,request(input,{module:'fabric',sourceKind:'fabric',conceptJobId:job.id,designId:'not-generated'}),caps),e=>e.code==='DESIGN_REQUIRED');
});
test('saree matching concepts work independently, but blouse-only models cannot produce a saree result',async()=>{
  const input=await inputs(),concept=await jobs.createStudioJob(input.owner,request(input,{module:'saree',action:'concepts',sourceKind:'model',designs:['same','contrast','embroidered','matching-designer']}),caps);
  assert.equal((await complete(concept,input.owner)).results.length,4);
  await assert.rejects(()=>jobs.createStudioJob(input.owner,request(input,{module:'saree',sourceKind:'model',conceptJobId:concept.id,designId:'same'}),caps),e=>e.code==='SAREE_PIPELINE_REQUIRED');
});
test('screenshots, raw fabric references and absent consent cannot bypass preprocessing requirements',async()=>{
  const input=await inputs();
  await assert.rejects(()=>jobs.createStudioJob(input.owner,request(input,{sourceKind:'screenshot'}),caps),e=>e.code==='SEGMENTATION_REQUIRED');
  await assert.rejects(()=>jobs.createStudioJob(input.owner,request(input,{sourceKind:'fabric'}),caps),e=>e.code==='UNSUPPORTED_GARMENT');
  await assert.rejects(()=>jobs.createStudioJob(input.owner,request(input,{consent:false}),caps),e=>e.code==='CONSENT_REQUIRED');
  await assert.rejects(()=>jobs.createStudioJob(input.owner,request(input,{action:'analysis'}),caps),e=>e.code==='ANALYSIS_UNAVAILABLE');
});
test('idempotency and atomic quota reservation prevent duplicate jobs and limit bypass',async()=>{
  const input=await inputs(),body=request(input),first=await jobs.createStudioJob(input.owner,body,caps);assert.equal((await jobs.createStudioJob(input.owner,body,caps)).id,first.id);
  await new jobs.AIJobStatusService().cancel(first.id,input.owner);process.env.AI_STUDIO_DAILY_LIMIT='1';
  await assert.rejects(()=>jobs.createStudioJob(input.owner,request(input),caps),e=>e.code==='LIMIT_REACHED');process.env.AI_STUDIO_DAILY_LIMIT='100';
});
test('upstream quota failures remain failures, with no substitute output',async()=>{
  const input=await inputs(),job=await jobs.createStudioJob(input.owner,request(input),caps);const result=await new jobs.AIJobStatusService().advance(job.id,input.owner,{async submit(){throw Error('ZeroGPU quota exceeded');},async poll(){throw Error();}});
  assert.equal(result.status,'failed');assert.equal(result.errorCode,'INFERENCE_LIMIT');assert.equal(result.results.length,0);
});
test('expired inputs are unavailable and expired submitting jobs fail instead of duplicating GPU work',async()=>{
  const input=await inputs(),job=await jobs.createStudioJob(input.owner,request(input),caps);
  await store.updateJob(job.id,input.owner,j=>({...j,leaseUntil:Date.now()-10}));const failed=await new jobs.AIJobStatusService().advance(job.id,input.owner,fakeProvider());assert.equal(failed.errorCode,'SUBMISSION_INTERRUPTED');
  const d=await database.openDatabase();try{await d.prepare('UPDATE fashion_studio_assets SET expires_at=? WHERE owner=?').run(Date.now()-1,input.owner);}finally{d.close();}
  assert.equal(await store.readAsset(input.reference.id,input.owner),null);await store.cleanupStudio();
});
test('palette inspection is explicitly non-AI; design prompts do not promise exact fabric copying',()=>{
  const info=new images.ImageAnalysisService().inspect({width:100,height:100,palette:['#77364e']});assert.equal(info.method,'image-inspection');assert.equal(info.features.neckline,'Unverified');
  assert.match(model.conceptPrompt(model.blouseDesigns[0],'fabric'),/not an exact fabric reproduction/);
  assert.deepEqual(provider.parseSSE('event: complete\ndata: [{"url":"https://example.test/result.png"}]'),{event:'complete',data:[{url:'https://example.test/result.png'}]});
  assert.equal(provider.gatewayOrigin(),null);
});
test('JPG orientation is normalized and all three supported formats are accepted',async()=>{
  const jpg=await sharp(png).withMetadata({orientation:6}).jpeg().toBuffer(),prepared=await uploader.prepare(jpg,'image/jpeg');
  assert.equal(prepared.width,192);assert.equal(prepared.height,128);assert.equal((await sharp(prepared.bytes).metadata()).orientation,undefined);
  const webp=await sharp(png).webp().toBuffer();assert.equal((await uploader.prepare(webp,'image/webp')).width,128);
});
test('cancellation prevents a late provider response from recreating deleted personal results',async()=>{
  const input=await inputs(),job=await jobs.createStudioJob(input.owner,request(input),caps),service=new jobs.AIJobStatusService(),p=fakeProvider();await service.advance(job.id,input.owner,p);
  let release,entered;const ready=new Promise(resolve=>{entered=resolve;});
  const pending=service.advance(job.id,input.owner,{...p,async poll(){entered();return new Promise(resolve=>{release=()=>resolve({status:'completed',bytes:png});});}});
  await ready;await service.cancel(job.id,input.owner);await store.eraseSessionImages(input.owner);release();
  assert.equal((await pending).status,'cancelled');const d=await database.openDatabase();try{assert.equal(Number((await d.prepare('SELECT COUNT(*) AS total FROM fashion_studio_assets WHERE owner=?').get(input.owner)).total),0);}finally{d.close();}
});
test('reviewed saree contract receives the saree, selected blouse and person as separate inputs',async()=>{
  const input=await inputs(),concept=await jobs.createStudioJob(input.owner,request(input,{module:'saree',action:'concepts',sourceKind:'model',designs:['same','contrast','embroidered','matching-designer']}),caps),done=await complete(concept,input.owner);
  const job=await jobs.createStudioJob(input.owner,request(input,{module:'saree',sourceKind:'model',conceptJobId:done.id,designId:'same'}),{...caps,saree:true});let received=false;
  const p={async submit(j,saree,person,blouse){assert.ok(saree.length&&person.length&&blouse.length);assert.equal(j.module,'saree');received=true;return {provider:'gateway',event:'test',endpoint:'studio'};},async poll(){return {status:'completed',bytes:png};}};
  assert.equal((await complete(job,input.owner,p)).status,'completed');assert.ok(received);
});
