import {appRequest} from '../../../../lib/local/security';
import {fabricTrialAccess} from '../../../../lib/local/fabric-trial';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  if(!appRequest(request))return Response.json({error:'Invalid request origin.'},{status:403});
  try{if(!await fabricTrialAccess(request))return Response.json({enabled:false},{status:404,headers:{'Cache-Control':'no-store'}});
    return Response.json({enabled:true},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({enabled:false},{status:503,headers:{'Cache-Control':'no-store'}});}
}
