import {randomUUID} from 'node:crypto';
import {StudioError,designFor,type StudioCapabilities,type StudioModule,type ReferenceKind,type JobAction,type StudioResult} from '../../app/fashion-studio/model';
import {createStoredJob,readStoredJob,listJobs,updateJob,readAsset,saveAsset,publicJob,cleanupStudio,type StoredJob} from './store';
import {capabilities,gatewayOrigin,HuggingFaceDemoProvider,ReviewedGatewayProvider,providerFailure,type AIProvider} from './providers';
import {ImageUploadService,ResultExportService} from './images';

const active=(job:StoredJob)=>['queued','running','submitting'].includes(job.status);
export class GarmentSegmentationService{
  async preparedReference(owner:string,referenceId:string,analysisJobId:unknown){
    if(typeof analysisJobId!=='string')throw new StudioError('SEGMENTATION_REQUIRED','Screenshot references need completed AI analysis and blouse segmentation first.');
    const job=await readStoredJob(analysisJobId,owner);
    if(!job||job.referenceId!==referenceId||job.status!=='completed'||job.analysis?.method!=='remote-ai'||!job.analysis.supported||!job.analysis.segmentedImageId)throw new StudioError('SEGMENTATION_REQUIRED','This screenshot has not produced a usable segmented blouse. Hidden design details remain uncertain.');
    return job.analysis.segmentedImageId;
  }
}
export class BlouseDesignService{
  validate(ids:unknown,module:StudioModule){if(!Array.isArray(ids)||ids.length!==4||new Set(ids).size!==4||ids.some(id=>typeof id!=='string'||!designFor(id,module)))throw new StudioError('DESIGN_SELECTION','Select exactly four different designs to generate.');return ids as string[];}
}
export class VirtualTryOnService{
  validate(module:StudioModule,source:ReferenceKind,c:StudioCapabilities){
    if(module==='saree'&&!c.saree)throw new StudioError('SAREE_PIPELINE_REQUIRED','Saree draping needs a reviewed saree-specific pipeline. Blouse-only try-on will not be used as a substitute.',503);
    if(module!=='saree'&&!c.reference)throw new StudioError('MODEL_UNAVAILABLE','The upper-body try-on model is unavailable.',503);
    if(module==='reference'&&source==='fabric')throw new StudioError('UNSUPPORTED_GARMENT','A raw fabric swatch is not a blouse. Use the Fabric-to-Blouse Designer first.');
  }
}
export async function studioSummary(owner:string){
  await cleanupStudio();const jobs=await listJobs(owner),today=new Date().setUTCHours(0,0,0,0),used=jobs.filter(j=>j.createdAt>=today).reduce((n,j)=>n+(j.action==='concepts'?j.designs.length:1),0);
  return {capabilities:await capabilities(used),jobs:jobs.map(publicJob)};
}
export async function createStudioJob(owner:string,input:Record<string,unknown>,providedCapabilities?:StudioCapabilities){
  const module=input.module as StudioModule,action=input.action as JobAction,sourceKind=input.sourceKind as ReferenceKind;
  if(!['reference','fabric','saree'].includes(module)||!['analysis','concepts','try-on'].includes(action)||!['flat-lay','model','screenshot','fabric'].includes(sourceKind))throw new StudioError('INVALID_WORKFLOW','Choose a valid studio workflow.');
  if(input.consent!==true)throw new StudioError('CONSENT_REQUIRED','Confirm permission to process these test images with the hosted service.');
  if(typeof input.referenceId!=='string'||typeof input.idempotency!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(input.idempotency))throw new StudioError('INVALID_INPUT','Upload a reference and try again.');
  const c=providedCapabilities||await capabilities(),reference=await readAsset(input.referenceId,owner);if(!reference||reference.asset.kind==='person')throw new StudioError('IMAGE_EXPIRED','The reference is unavailable or expired. Upload it again.');
  let referenceId=input.referenceId,personId:string|undefined,designs:string[]=[],designAssetId:string|undefined;
  if(action==='analysis'&&!c.analysis)throw new StudioError('ANALYSIS_UNAVAILABLE','A reviewed image-understanding service is not connected. The local palette inspection is not AI analysis.',503);
  if(action==='concepts'){
    if(module==='reference')throw new StudioError('INVALID_WORKFLOW','Use a design workflow to generate concepts.');
    if(!c.concepts)throw new StudioError('MODEL_UNAVAILABLE','Design image generation is unavailable.',503);
    if(sourceKind==='screenshot'){
      if(!c.analysis||!c.segmentation)throw new StudioError('ANALYSIS_REQUIRED','A screenshot needs reviewed image analysis and garment segmentation before design generation. Use a clean fabric or saree image for this test.');
      referenceId=await new GarmentSegmentationService().preparedReference(owner,referenceId,input.analysisJobId);
    }
    designs=new BlouseDesignService().validate(input.designs,module);
  }
  if(action==='try-on'){
    new VirtualTryOnService().validate(module,sourceKind,c);
    if(typeof input.personId!=='string')throw new StudioError('PERSON_REQUIRED','Upload a customer test photograph.');
    const person=await readAsset(input.personId,owner);if(!person||person.asset.kind!=='person')throw new StudioError('IMAGE_EXPIRED','The customer image is unavailable or expired. Upload it again.');personId=input.personId;
    if(module==='reference'&&sourceKind==='screenshot'){if(!c.segmentation)throw new StudioError('SEGMENTATION_REQUIRED','Screenshot segmentation is not connected. Use a clean blouse photo instead.',503);referenceId=await new GarmentSegmentationService().preparedReference(owner,referenceId,input.analysisJobId);}
    if(module!=='reference'){
      if(typeof input.conceptJobId!=='string'||typeof input.designId!=='string')throw new StudioError('DESIGN_REQUIRED','Generate and select a blouse concept first.');
      const concept=await readStoredJob(input.conceptJobId,owner),result=concept?.results.find(r=>r.designId===input.designId);
      if(!concept||concept.module!==module||concept.action!=='concepts'||(concept.sourceReferenceId||concept.referenceId)!==input.referenceId||!result||!await readAsset(result.asset.id,owner))throw new StudioError('DESIGN_REQUIRED','Select an available generated concept from this reference.');
      designs=[result.designId];if(module==='fabric')referenceId=result.asset.id;else designAssetId=result.asset.id;
    }
  }
  const now=Date.now(),job:StoredJob={id:randomUUID(),owner,module,action,sourceKind:action==='try-on'&&(module==='fabric'||module==='reference'&&sourceKind==='screenshot')?'flat-lay':sourceKind,referenceId,sourceReferenceId:input.referenceId,personId,designAssetId,designs,consent:true,idempotency:input.idempotency,status:'submitting',step:0,leaseUntil:0,createdAt:now,updatedAt:now,elapsedMs:0,expiresAt:now+12*60*1000,message:'Waiting to submit the AI job.',results:[],provider:action==='analysis'||module==='saree'&&action==='try-on'||process.env.AI_STUDIO_ALLOW_DEMOS!=='true'?'Reviewed pipeline':action==='concepts'?'Qwen Image Edit 2511 · admin demo':'FASHN VTON 1.5 · admin demo'};
  return publicJob(await createStoredJob(job));
}
const demo=new HuggingFaceDemoProvider(),gateway=new ReviewedGatewayProvider();
function chooseProvider(job:StoredJob):AIProvider{return job.remote?.provider==='gateway'||job.action==='analysis'||job.module==='saree'&&job.action==='try-on'||process.env.AI_STUDIO_ALLOW_DEMOS!=='true'?gateway:demo;}
export class AIJobStatusService{
  async advance(id:string,owner:string,overrideProvider?:AIProvider){
    let acquired=false;
    let job=await updateJob(id,owner,j=>{
      if(!active(j)||j.leaseUntil>Date.now())return j;
      if(j.expiresAt<=Date.now())return {...j,status:'failed',errorCode:'TIMEOUT',error:'Generation exceeded the 12-minute test deadline.',message:'Generation timed out.',updatedAt:Date.now()};
      // Submission acknowledgement lost during restart: do not blindly duplicate GPU work.
      if(j.status==='submitting'&&j.leaseUntil!==0)return {...j,status:'failed',errorCode:'SUBMISSION_INTERRUPTED',error:'Submission was interrupted. The remote job may still finish; no replacement was submitted.',message:'Submission interrupted.',updatedAt:Date.now()};
      acquired=true;return {...j,leaseUntil:Date.now()+75000,updatedAt:Date.now()};
    });
    if(!job||!acquired)return job?publicJob(job):null;
    try{
      const provider=overrideProvider||chooseProvider(job);
      if(!job.remote){
        const reference=await readAsset(job.referenceId,owner),person=job.personId?await readAsset(job.personId,owner):null,blouse=job.designAssetId?await readAsset(job.designAssetId,owner):null;
        if(!reference||job.personId&&!person||job.designAssetId&&!blouse)throw new StudioError('IMAGE_EXPIRED','An input image expired. Upload the images again.');
        const remote=await provider.submit(job,reference.bytes,person?.bytes,blouse?.bytes);
        job=await updateJob(id,owner,j=>active(j)?{...j,remote,status:'queued',leaseUntil:0,message:j.action==='concepts'?`Generating concept ${j.step+1} of 4…`:'AI job queued with the hosted service.',updatedAt:Date.now()}:j);
      }else{
        const result=await provider.poll(job.remote);
        if(result.status==='completed'){
          let output:StudioResult|undefined;
          if(result.bytes){const bytes=await new ResultExportService().png(result.bytes),prepared=await new ImageUploadService().prepare(bytes,'image/png');const asset=await saveAsset(owner,bytes,{width:prepared.width,height:prepared.height,palette:prepared.palette,kind:'result'},id);const design=designFor(job.designs[job.step],job.module);output={designId:design?.id||'reference',name:design?.name||'Blouse reference try-on',asset,label:job.action==='concepts'?'AI-generated concept' as const:'AI try-on preview' as const};}
          if(job.action==='analysis'&&!result.analysis||job.action!=='analysis'&&!output)throw new StudioError('INVALID_OUTPUT','The model completed without the expected result.',502);
          if(result.analysis&&result.segmented){const prepared=await new ImageUploadService().prepare(result.segmented,'image/png');const asset=await saveAsset(owner,result.segmented,{width:prepared.width,height:prepared.height,palette:prepared.palette,kind:'result'},id);result.analysis.segmentedImageId=asset.id;}
          const more=job.action==='concepts'&&job.step+1<job.designs.length;
          job=await updateJob(id,owner,j=>active(j)?{...j,results:output?[...j.results,output]:j.results,analysis:result.analysis||j.analysis,remote:undefined,step:j.step+1,status:more?'submitting':'completed',leaseUntil:0,message:more?`Concept ${j.step+1} of 4 ready. Preparing the next design…`:j.action==='analysis'?'AI analysis ready. Review its uncertainty notes.':'AI result ready for visual review. Accuracy has not been verified.',updatedAt:Date.now()}:j);
        }else job=await updateJob(id,owner,j=>active(j)?{...j,status:result.status,leaseUntil:0,updatedAt:Date.now(),message:'Waiting for the hosted GPU. No preview has been generated yet.'}:j);
      }
    }catch(error){const failure=providerFailure(error);job=await updateJob(id,owner,j=>active(j)?{...j,status:'failed',error:failure.message,errorCode:failure.code,leaseUntil:0,message:'Generation failed. Any earlier concepts remain available until expiry.',updatedAt:Date.now()}:j);}
    return job?publicJob(job):null;
  }
  async cancel(id:string,owner:string){
    const job=await updateJob(id,owner,j=>active(j)?{...j,status:'cancelled',message:'Stopped tracking this job. A public demo may still finish processing upstream.',leaseUntil:0,updatedAt:Date.now()}:j);
    if(job?.remote?.provider==='gateway')await gateway.cancel(job.remote).catch(()=>{});return job?publicJob(job):null;
  }
}
