import {guard,studioJson,studioError} from '../../../../lib/fashion-studio/http';
import {createStudioJob} from '../../../../lib/fashion-studio/jobs';
import {boundedJson} from '../../../../lib/local/security';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(req:Request){try{const admin=await guard(req,true),body=await boundedJson(req,5000);return studioJson({job:await createStudioJob(admin.id,body)},202);}catch(e){return studioError(e);}}
