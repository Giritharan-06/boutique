import {studioAdmin} from './access';
import {appRequest} from '../local/security';
import {StudioError} from '../../app/fashion-studio/model';
export const studioJson=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
export async function guard(req:Request,write=false){if(!appRequest(req,write))throw new StudioError('ORIGIN','Request origin is not allowed.',403);return studioAdmin(req);}
export function studioError(error:unknown){return error instanceof StudioError?studioJson({error:error.message,code:error.code},error.status):studioJson({error:'The studio could not complete this request. Check configuration or try again.',code:'STUDIO_ERROR'},503);}
