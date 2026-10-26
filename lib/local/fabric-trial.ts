import {getAuthUser} from './auth';

export function fabricTrialEnabled(){return process.env.FABRIC_TRIAL_ENABLED==='true';}
export async function fabricTrialAccess(request:Request){
  if(!fabricTrialEnabled())return false;
  const user=await getAuthUser(request,'admin');
  return user?.role==='admin';
}
