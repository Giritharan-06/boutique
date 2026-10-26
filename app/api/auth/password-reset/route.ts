import {appRequest,boundedJson} from '../../../../lib/local/security';
import {completePasswordReset,requestPasswordReset,resetEmailConfigured,resetMessage,resetOrigin,resetUnavailable} from '../../../../lib/local/password-reset';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
// Per-instance burst protection supplements the persisted per-account cooldown.
let windowStart=Date.now(),requests=0;
export async function POST(req:Request){
  if(!appRequest(req,true))return json({error:'Invalid request origin.'},403);
  if(Date.now()-windowStart>60000){windowStart=Date.now();requests=0;}
  if(++requests>30)return json({error:'Too many attempts. Please wait a minute and try again.'},429);
  try{
    const body=await boundedJson(req,4000);
    if(body.role!=='customer'&&body.role!=='admin')throw Error('Choose an account type.');
    if(body.action==='request'){
      if(!resetEmailConfigured())return json({error:resetUnavailable},503);
      if(typeof body.email!=='string')throw Error('Enter a valid email address.');
      await requestPasswordReset(body.email,body.role,resetOrigin());
      return json({message:resetMessage});
    }
    if(body.action==='reset'){
      if(typeof body.token!=='string'||typeof body.password!=='string')throw Error('Open your reset link and enter a new password.');
      await completePasswordReset(body.token,body.password,body.role);
      return json({message:'Your password has been updated. Sign in with your new password.'});
    }
    throw Error('Choose a password recovery action.');
  }catch(error){
    const message=error instanceof Error?error.message:'';
    const safe=['Enter a valid email address.','Choose an account type.','Choose a password recovery action.','Open your reset link and enter a new password.','This reset link is invalid or has expired. Request a new link.','Use a password between 10 and 128 characters.'];
    return json({error:safe.includes(message)?message:resetUnavailable},safe.includes(message)?400:503);
  }
}
