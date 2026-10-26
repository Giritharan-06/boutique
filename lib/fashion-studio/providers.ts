import {StudioError,conceptPrompt,designFor,type StudioCapabilities,type Analysis,type StudioModule} from '../../app/fashion-studio/model';
import {dailyLimit} from './access';
import {storageReady,type StoredJob} from './store';
export const demoHosts={fashn:'https://fashn-ai-fashn-vton-1-5.hf.space',qwen:'https://qwen-qwen-image-edit.hf.space',qwen2511:'https://qwen-qwen-image-edit-2511.hf.space'} as const;
const headers=():Record<string,string>=>process.env.HF_TOKEN?{Authorization:'Bearer '+process.env.HF_TOKEN}:{};
export type ProviderPoll={status:'queued'|'running'|'completed';bytes?:Buffer;analysis?:Analysis;segmented?:Buffer};
export interface AIProvider{submit(job:StoredJob,reference:Buffer,person?:Buffer,blouse?:Buffer):Promise<NonNullable<StoredJob['remote']>>;poll(remote:NonNullable<StoredJob['remote']>):Promise<ProviderPoll>;cancel?(remote:NonNullable<StoredJob['remote']>):Promise<void>}
export function providerFailure(error:unknown){
  if(error instanceof StudioError)return error;
  const message=error instanceof Error?error.message:String(error);
  if(/quota|zerogpu|429|credit|exceeded|GPU duration/i.test(message))return new StudioError('INFERENCE_LIMIT','Hosted inference limit reached. Wait for the provider quota to reset.',429);
  if(/log.?in|unauthorized|authentication|401|403/i.test(message))return new StudioError('PROVIDER_AUTH','The hosted service requires authorized access. Configure a scoped server-side Hugging Face token.',503);
  if(/timeout|abort/i.test(message))return new StudioError('TIMEOUT','The provider did not respond in time. Retry later.',504);
  return new StudioError('PROVIDER_UNAVAILABLE','The hosted model is unavailable or rejected the images. No result was generated.',503);
}
export async function boundedResponse(response:Response,max:number){
  if(!response.ok)throw new StudioError(response.status===429||response.status===402?'INFERENCE_LIMIT':'PROVIDER_UNAVAILABLE',response.status===429||response.status===402?'Hosted inference limit reached.':'The hosted provider is unavailable.',response.status===429?429:503);
  if(Number(response.headers.get('content-length')||0)>max)throw new StudioError('INVALID_OUTPUT','The provider response was too large.',502);
  const reader=response.body?.getReader();if(!reader)throw new StudioError('INVALID_OUTPUT','The provider returned no response.',502);const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new StudioError('INVALID_OUTPUT','The provider response was too large.',502);chunks.push(value);}return Buffer.concat(chunks);}finally{await reader.cancel().catch(()=>{});}
}
async function fetchImage(url:string,host:string){const parsed=new URL(url,host);if(parsed.protocol!=='https:'||parsed.origin!==host||parsed.username||parsed.password)throw new StudioError('INVALID_OUTPUT','The model returned an unexpected image address.',502);return boundedResponse(await fetch(parsed,{headers:headers(),redirect:'error',signal:AbortSignal.timeout(20000)}),10*1024*1024);}
export function parseSSE(block:string){const event=block.match(/^event: ?([^\r\n]+)/m)?.[1],data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');return {event,data:data?JSON.parse(data):null};}
async function uploadDemo(host:string,bytes:Buffer){
  const form=new FormData();form.append('files',new Blob([new Uint8Array(bytes)],{type:'image/png'}),'studio-'+crypto.randomUUID()+'.png');
  const response=await fetch(host+'/gradio_api/upload',{method:'POST',headers:headers(),body:form,redirect:'error',signal:AbortSignal.timeout(20000)});
  const data=JSON.parse((await boundedResponse(response,10000)).toString());if(!Array.isArray(data)||typeof data[0]!=='string'||!data[0].startsWith('/tmp/'))throw new StudioError('INVALID_OUTPUT','The provider did not accept the temporary image.',502);
  return {path:data[0],meta:{_type:'gradio.FileData'}};
}
/** Verified Gradio call API. Only official, fixed hosts; no user-provided URLs. */
export class HuggingFaceDemoProvider implements AIProvider{
  async submit(job:StoredJob,reference:Buffer,person?:Buffer,blouse?:Buffer){
    if(process.env.AI_STUDIO_ALLOW_DEMOS!=='true')throw new StudioError('MODEL_UNAVAILABLE','Admin demo inference is disabled.',503);
    const provider=job.action==='concepts'?'qwen2511':'fashn',host=demoHosts[provider];
    const garment=await uploadDemo(host,reference);let data:unknown[],endpoint:string;
    if(provider==='qwen2511'){
      const design=designFor(job.designs[job.step],job.module);if(!design)throw new StudioError('INVALID_DESIGN','Choose a valid blouse design.');
      endpoint='infer';data=[[{image:garment,caption:null}],conceptPrompt(design,job.module),42+job.step,false,4,30,768,768,false];
    }else{
      if(!person||job.module==='saree'||job.sourceKind==='screenshot'||job.sourceKind==='fabric')throw new StudioError('UNSUPPORTED_GARMENT','This reference needs a compatible preprocessing pipeline.');
      endpoint='try_on';data=[await uploadDemo(host,person),garment,'tops',job.sourceKind==='model'?'model':'flat-lay',30,1.5,42,true];
    }
    const response=await fetch(`${host}/gradio_api/call/${endpoint}`,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({data}),redirect:'error',signal:AbortSignal.timeout(15000)});
    const result=JSON.parse((await boundedResponse(response,20000)).toString());if(typeof result.event_id!=='string'||!/^[a-f0-9-]{20,80}$/i.test(result.event_id))throw new StudioError('INVALID_OUTPUT','The model returned no valid job identifier.',502);
    return {provider,event:result.event_id,endpoint} as const;
  }
  async poll(remote:NonNullable<StoredJob['remote']>):Promise<ProviderPoll>{
    if(remote.provider==='gateway')throw Error('Wrong provider.');
    const host=demoHosts[remote.provider],controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
    try{
      const response=await fetch(`${host}/gradio_api/call/${remote.endpoint}/${remote.event}`,{headers:headers(),redirect:'error',signal:controller.signal});if(!response.ok)await boundedResponse(response,1000);
      reader=response.body?.getReader();if(!reader)throw Error('Empty stream');const decoder=new TextDecoder();let buffer='',total=0;
      while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>100000)throw new StudioError('INVALID_OUTPUT','Unexpected provider event stream.',502);buffer+=decoder.decode(part.value,{stream:true});let at;
        while((at=buffer.search(/\r?\n\r?\n/))!==-1){const block=buffer.slice(0,at),separator=buffer.slice(at).match(/^\r?\n\r?\n/)![0];buffer=buffer.slice(at+separator.length);const event=parseSSE(block);
          if(event.event==='error')throw Error(typeof event.data==='string'?event.data:JSON.stringify(event.data));
          if(event.event==='complete'){const image=remote.provider==='qwen2511'?event.data?.[0]?.[0]?.image:event.data?.[0];if(!image||typeof image.url!=='string')throw new StudioError('INVALID_OUTPUT','The model ended without an image.',502);return {status:'completed',bytes:await fetchImage(image.url,host)};}
        }
      }
      throw new StudioError('PROVIDER_UNAVAILABLE','The model stream ended before a result was available.',503);
    }catch(error){if(controller.signal.aborted)return {status:'queued'};throw providerFailure(error);}finally{clearTimeout(timer);await reader?.cancel().catch(()=>{});}
  }
}

export function gatewayOrigin(){
  if(process.env.AI_STUDIO_GATEWAY_APPROVED!=='true'||!process.env.AI_STUDIO_GATEWAY_URL)return null;
  const url=new URL(process.env.AI_STUDIO_GATEWAY_URL);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!(/\.hf\.space$|\.endpoints\.huggingface\.cloud$/.test(url.hostname)))throw new StudioError('GATEWAY_CONFIG','Use a reviewed HTTPS Hugging Face endpoint origin.',503);
  return url.origin;
}
async function gatewayRequest(path:string,body?:unknown){const origin=gatewayOrigin();if(!origin)throw new StudioError('MODEL_UNAVAILABLE','A reviewed AI pipeline has not been connected.',503);const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{...headers(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});return JSON.parse((await boundedResponse(response,15*1024*1024)).toString());}
export class ReviewedGatewayProvider implements AIProvider{
  async submit(job:StoredJob,reference:Buffer,person?:Buffer,blouse?:Buffer){
    const response=await gatewayRequest('/studio/jobs',{idempotencyKey:job.id+'-'+job.step,module:job.module,action:job.action,sourceKind:job.sourceKind,designId:job.designs[job.step],reference:'data:image/png;base64,'+reference.toString('base64'),person:person?'data:image/png;base64,'+person.toString('base64'):undefined,blouse:blouse?'data:image/png;base64,'+blouse.toString('base64'):undefined});
    if(typeof response.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(response.id))throw new StudioError('INVALID_OUTPUT','The pipeline returned an invalid job identifier.',502);
    return {provider:'gateway',event:response.id,endpoint:'studio'} as const;
  }
  async poll(remote:NonNullable<StoredJob['remote']>):Promise<ProviderPoll>{
    const result=await gatewayRequest('/studio/jobs/'+remote.event);
    if(result.status==='failed')throw new StudioError('GENERATION_FAILED','The reviewed pipeline could not process these images.',502);
    if(result.status==='completed'){
      if(result.analysis){const a=result.analysis;if(typeof a.summary!=='string'||!Array.isArray(a.uncertainties)||typeof a.features!=='object')throw new StudioError('INVALID_OUTPUT','Analysis response was incomplete.',502);return {status:'completed',analysis:{method:'remote-ai',summary:a.summary.slice(0,1000),palette:[],features:Object.fromEntries(Object.entries(a.features).filter(([k,v])=>['neckline','sleeves','pattern','embroidery','border','pallu','visibility'].includes(k)&&typeof v==='string').map(([k,v])=>[k,String(v).slice(0,300)])),uncertainties:a.uncertainties.filter((v:unknown)=>typeof v==='string').map((v:string)=>v.slice(0,300)).slice(0,10),supported:a.supported===true},segmented:typeof result.segmented==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(result.segmented)?Buffer.from(result.segmented.split(',')[1],'base64'):undefined};}
      if(typeof result.image!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(result.image))throw new StudioError('INVALID_OUTPUT','The pipeline returned no valid image.',502);
      return {status:'completed',bytes:Buffer.from(result.image.split(',')[1],'base64')};
    }
    if(!['queued','running'].includes(result.status))throw new StudioError('INVALID_OUTPUT','Unknown pipeline job status.',502);
    return {status:result.status};
  }
  async cancel(remote:NonNullable<StoredJob['remote']>){await gatewayRequest('/studio/jobs/'+remote.event+'/cancel',{});}
}
export async function capabilities(used=0):Promise<StudioCapabilities>{
  const demos=process.env.AI_STUDIO_ALLOW_DEMOS==='true';let reference=false,concepts=false,saree=false,analysis=false,segmentation=false;
  if(demos){const checks=await Promise.allSettled(Object.entries(demoHosts).filter(([name])=>name!=='qwen').map(async([name,host])=>{const response=await fetch(host+'/gradio_api/info',{headers:headers(),signal:AbortSignal.timeout(7000),redirect:'error'});const info=JSON.parse((await boundedResponse(response,150000)).toString());return {name,available:Boolean(info.named_endpoints?.[name==='fashn'?'/try_on':'/infer'])};}));for(const check of checks)if(check.status==='fulfilled'){if(check.value.name==='fashn')reference=check.value.available;else concepts=check.value.available;}}
  try{if(gatewayOrigin()){const c=await gatewayRequest('/studio/capabilities');if(c.protocol===1&&c.commercialUseReviewed===true){reference||=c.reference===true;concepts||=c.concepts===true;analysis=c.analysis===true;segmentation=c.segmentation===true;saree=c.sareeSpecific===true&&process.env.AI_STUDIO_SAREE_REVIEWED==='true';}}}catch{}
  return {enabled:true,demos,storageReady:storageReady(),reference,concepts,saree,analysis,segmentation,dailyLimit:dailyLimit(),used,remaining:Math.max(0,dailyLimit()-used),modules:{reference:{state:reference?'trial':'blocked',message:reference?'Upper-body try-on trial. Clear model-worn and isolated garments supported. Screenshots require reviewed analysis and segmentation.':'Connect or enable an approved garment try-on service.'},fabric:{state:concepts?'trial':'blocked',message:concepts?'Generate four concepts from the fabric, then select one for upper-body try-on. Patterns may change.':'Design generation is unavailable. Upload and inspection still work.'},saree:{state:saree?'trial':'blocked',message:saree?'Reviewed saree-specific pipeline connected; quality remains unverified until tested.':'Saree draping is not connected. Matching blouse concepts can be tested independently; no final saree result will be simulated.'}}};
}
