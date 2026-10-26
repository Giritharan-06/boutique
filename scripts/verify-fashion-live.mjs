import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fashionRuntime} from './fashion-runtime.mjs';
const load=await fashionRuntime(),{ImageUploadService}=await load('images'),{createStudioJob,AIJobStatusService}=await load('jobs'),{capabilities}=await load('providers'),store=await load('store'),db=await load('database');
const owner='synthetic-review-'+Date.now(),uploader=new ImageUploadService(),service=new AIJobStatusService();mkdirSync('.local/fashion-live',{recursive:true});
const reports=[];
async function run(module,action,source,person,extra={}){
  const c=await capabilities();const job=await createStudioJob(owner,{module,action,referenceId:source.id,personId:person?.id,sourceKind:module==='fabric'?'fabric':'flat-lay',consent:true,idempotency:crypto.randomUUID(),...extra},c);let current=job;const end=Date.now()+11*60*1000;
  console.log(JSON.stringify({module,action,id:job.id,status:job.status}));
  while(['queued','running','submitting'].includes(current.status)&&Date.now()<end){current=await service.advance(job.id,owner);console.log(JSON.stringify({module,status:current.status,results:current.results.length,errorCode:current.errorCode}));if(['queued','running','submitting'].includes(current.status))await new Promise(resolve=>setTimeout(resolve,3000));}
  if(['queued','running','submitting'].includes(current.status))current=await service.cancel(job.id,owner);
  for(const result of current.results){const asset=await store.readAsset(result.asset.id,owner);if(asset)writeFileSync(`.local/fashion-live/${module}-${action}-${result.designId}.png`,asset.bytes);}
  reports.push(current);writeFileSync('.local/fashion-live/report.json',JSON.stringify(reports,null,2));return current;
}
try{
  const person=await uploader.upload(owner,readFileSync('.local/fashion-fixtures/synthetic-person.jpg'),'image/jpeg','person');
  const reference=await uploader.upload(owner,readFileSync('.local/fashion-fixtures/ai-blouse-reference.png'),'image/png','reference');
  await run('reference','try-on',reference,person);
  const fabric=await uploader.upload(owner,readFileSync('.local/fashion-fixtures/printed-fabric.png'),'image/png','reference');
  const designs=await run('fabric','concepts',fabric,undefined,{designs:['boat','princess','puff','elbow']});
  if(designs.results.length)await run('fabric','try-on',fabric,person,{conceptJobId:designs.id,designId:designs.results[0].designId});
  try{await run('saree','try-on',reference,person,{sourceKind:'model'});}catch(error){reports.push({module:'saree',status:'blocked',code:error.code,error:error.message});writeFileSync('.local/fashion-live/report.json',JSON.stringify(reports,null,2));console.log('Saree: blocked honestly — no reviewed draping pipeline.');}
}finally{await store.eraseSessionImages(owner);await db.closeDatabasePool();}
