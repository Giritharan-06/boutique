import {guard,studioJson,studioError} from '../../../lib/fashion-studio/http';
import {studioSummary,AIJobStatusService} from '../../../lib/fashion-studio/jobs';
import {boundedJson} from '../../../lib/local/security';
import {eraseSessionImages,listJobs} from '../../../lib/fashion-studio/store';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(req:Request){try{const admin=await guard(req);return studioJson(await studioSummary(admin.id));}catch(e){return studioError(e);}}
export async function DELETE(req:Request){try{const admin=await guard(req,true);const jobs=await listJobs(admin.id);for(const job of jobs)if(['submitting','queued','running'].includes(job.status))await new AIJobStatusService().cancel(job.id,admin.id);await eraseSessionImages(admin.id);return studioJson({ok:true});}catch(e){return studioError(e);}}
