import {guard,studioJson,studioError} from '../../../../lib/fashion-studio/http';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{await guard(req);return studioJson({enabled:true});}catch(e){return studioError(e);}}
