import {Client,handle_file} from '@gradio/client';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {readProductImage} from './product-images';
import {settlePreview} from './commerce';

export const SPACE='fashn-ai/fashn-vton-1.5';
export const SPACE_URL='https://huggingface.co/spaces/'+SPACE;
const HOST='fashn-ai-fashn-vton-1-5.hf.space';
type Job={id:string;accountId:string;billable:boolean;status:'queued'|'running'|'completed'|'failed'|'cancelled';message:string;created:number;imageUrl?:string;error?:string;cancel?:()=>void};
const state=globalThis as typeof globalThis & {aariniHostedJobs?:Map<string,Job>};
const jobs=state.aariniHostedJobs??=new Map<string,Job>();
function refundLater(job:Job){if(job.billable)void settlePreview(job.id,false).catch(()=>console.error('Preview allowance recovery will retry.'));}
async function prune(){for(const [id,job]of jobs){if(Date.now()-job.created>15*60*1000){job.cancel?.();if(job.billable)await settlePreview(id,false);jobs.delete(id);}}}
export async function readJob(id:string,owner:string){await prune();const job=jobs.get(id);if(!job||job.accountId!==owner)return null;const {cancel,accountId,billable,...safe}=job;return safe;}
export async function cancelJob(id:string,owner:string){const job=jobs.get(id);if(!job||job.accountId!==owner)return false;if(job.status==='completed')return false;job.cancel?.();job.status='cancelled';job.message='Preview cancelled.';if(job.billable)await settlePreview(id,false);delete job.imageUrl;return true;}
export async function providerStatus(){try{const r=await fetch('https://'+HOST+'/gradio_api/info',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return {connected:true,model:'FASHN VTON 1.5',provider:'Hugging Face',hosted:true,free:true,url:SPACE_URL};}catch{return {connected:false,model:'FASHN VTON 1.5',provider:'Hugging Face',hosted:true,free:true,url:SPACE_URL,error:'The free hosted demo is temporarily unavailable. Try again later.'};}}
export function friendlyError(error:unknown){const e=error as {message?:string};const text=typeof error==='string'?error:e?.message||'';
 if(/quota|exceed|zerogpu|limit|429/i.test(text))return 'Limit reached';
 if(/another preview/i.test(text))return 'Another preview is running. Please wait.';
 if(/unsupported|decode|image format|corrupt/i.test(text))return 'Choose a valid JPG, PNG or WebP photo.';
 if(/^(Choose|Allow|Outfit|Please sign in)/i.test(text))return text.slice(0,200);
 return 'Preview is unavailable right now. Please try again later.';
}
export async function createJob(photo:string,imageSet:string,imageIndex:number,productImage:string|undefined,owner:{id:string;accountId:string;billable:boolean}){
 await prune();if([...jobs.values()].some(j=>j.status==='queued'||j.status==='running'))throw Error('Another preview is already running. Wait for it to finish.');
 if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))throw Error('Choose a JPG, PNG or WebP photo.');
 if(!['sarees','chudithar','occasionwear','contemporary'].includes(imageSet)||!Number.isInteger(imageIndex)||imageIndex<0||imageIndex>3)throw Error('Choose a valid catalogue outfit.');
 const raw=Buffer.from(photo.split(',')[1],'base64');if(raw.length>5*1024*1024)throw Error('Choose a photo under 5 MB.');
 // Decode, validate and strip metadata before any upload. This is ordinary image
 // formatting; all AI inference is done by the remote Hugging Face Space.
 const person=await sharp(raw,{limitInputPixels:25_000_000}).rotate().resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true}).png().toBuffer();
 const uploaded=productImage?.match(/^\/api\/product-images\/([a-f0-9-]{36})$/);const source=uploaded?await readProductImage(uploaded[1]):await readFile(path.join(process.cwd(),'public/collections',imageSet+'-'+(imageIndex+1)+'.jpg'));if(!source)throw Error('The selected product photo could not be opened.');
 const garment=await sharp(source,{limitInputPixels:25_000_000}).resize({width:1024,height:1536,fit:'inside',withoutEnlargement:true}).png().toBuffer();
 // Validate again after asynchronous decoding to prevent double submissions.
 if([...jobs.values()].some(j=>j.status==='queued'||j.status==='running'))throw Error('Another preview is already running.');
 const job:Job={id:owner.id,accountId:owner.accountId,billable:owner.billable,status:'queued',message:'Preparing your preview…',created:Date.now()};jobs.set(job.id,job);
 const expiry=setTimeout(()=>{jobs.get(job.id)?.cancel?.();refundLater(job);jobs.delete(job.id);},15*60*1000);expiry.unref();
 void runJob(job,person,garment);return {jobId:job.id,status:job.status};
}
async function runJob(job:Job,person:Buffer,garment:Buffer){
 let timer:ReturnType<typeof setTimeout>|undefined;
 let client:Client|undefined;
 try{
  timer=setTimeout(()=>{job.cancel?.();client?.close();if(job.status!=='completed'&&job.status!=='cancelled'){job.status='failed';job.error='Preview is taking too long. Please try again.';refundLater(job);}},5*60*1000);
  client=await Client.connect(SPACE,{events:['data','status']});
  if(job.status==='cancelled'||job.status==='failed')return;
  const submission=client.submit('/try_on',{person_image:handle_file(new Blob([new Uint8Array(person)],{type:'image/png'})),garment_image:handle_file(new Blob([new Uint8Array(garment)],{type:'image/png'})),category:'one-pieces',garment_photo_type:'model',num_timesteps:20,guidance_scale:1.5,seed:42,segmentation_free:true});
  job.cancel=()=>{void submission.cancel();};
  for await(const event of submission){
   if((job.status as string)==='cancelled'||(job.status as string)==='failed')break;
   if(event.type==='status'){
    if(event.stage==='error')throw Error(typeof event.message==='string'?event.message:'The hosted model rejected these inputs.');
    job.status=event.stage==='generating'?'running':'queued';job.message=event.stage==='generating'?'Creating your look…':'Your preview will begin shortly…';
   }else if(event.type==='data'){
    const output=(event.data as {url?:string}[])[0];if(!output?.url)throw Error('The hosted model returned no image.');
    const url=new URL(output.url);if(url.protocol!=='https:'||url.hostname!==HOST)throw Error('Unexpected output address from the hosted model.');
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Unable to retrieve the generated preview.');
    const raw=Buffer.from(await response.arrayBuffer());if(raw.length>15*1024*1024)throw Error('The generated image is too large.');
    const image=await sharp(raw,{limitInputPixels:25_000_000}).png().toBuffer();
    if((job.status as string)==='cancelled')break;
    if(job.billable)await settlePreview(job.id,true);if((job.status as string)==='cancelled'||(job.status as string)==='failed')break;job.imageUrl='data:image/png;base64,'+image.toString('base64');job.status='completed';job.message='Your preview is ready.';break;
   }
  }
  if(!['completed','cancelled','failed'].includes(job.status))throw Error('The hosted model ended without a preview. Please retry.');
 }catch(e){if((job.status as string)!=='cancelled'){job.status='failed';job.error=friendlyError(e);if(job.billable)await settlePreview(job.id,false).catch(()=>console.error('Preview allowance recovery will retry.'));}}
 finally{if(timer)clearTimeout(timer);client?.close();delete job.cancel;}
}
