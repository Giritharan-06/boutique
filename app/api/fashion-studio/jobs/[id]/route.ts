import {guard,studioJson,studioError} from '../../../../../lib/fashion-studio/http';
import {AIJobStatusService} from '../../../../../lib/fashion-studio/jobs';
import {readStoredJob,publicJob,updateJob} from '../../../../../lib/fashion-studio/store';
import {boundedJson} from '../../../../../lib/local/security';
import {StudioError} from '../../../../fashion-studio/model';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){try{const user=await guard(req),{id}=await ctx.params,job=await readStoredJob(id,user.id);return job?studioJson({job:publicJob(job)}):studioJson({error:'Job not found.'},404);}catch(e){return studioError(e);}}
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){try{const user=await guard(req,true),{id}=await ctx.params,body=await boundedJson(req,2000),service=new AIJobStatusService();let job;
  if(body.action==='advance')job=await service.advance(id,user.id);
  else if(body.action==='cancel')job=await service.cancel(id,user.id);
  else if(body.action==='review'){
    const keys=['identity','colour','pattern','neckline','sleeves','alignment','drape'];if(!body.review||keys.some(k=>!Number.isInteger(body.review[k])||body.review[k]<0||body.review[k]>5)||typeof body.review.notes!=='string'||body.review.notes.length>500)throw new StudioError('INVALID_REVIEW','Use scores from 0 (not evaluated) to 5, and notes under 500 characters.');
    const changed=await updateJob(id,user.id,j=>{if(j.status!=='completed')throw new StudioError('INVALID_REVIEW','Only completed jobs can be evaluated.');return {...j,review:Object.fromEntries([...keys.map(k=>[k,body.review[k]]),['notes',body.review.notes]]) as NonNullable<typeof j.review>};});job=changed?publicJob(changed):null;
  }else throw new StudioError('INVALID_ACTION','Choose a valid job action.');
  return job?studioJson({job}):studioJson({error:'Job not found.'},404);
}catch(e){return studioError(e);}}
