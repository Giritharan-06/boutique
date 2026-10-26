import {getAuthUser} from '../local/auth';
import {StudioError} from '../../app/fashion-studio/model';
export const studioEnabled=()=>process.env.AI_FASHION_STUDIO_ENABLED==='true';
export async function studioAdmin(request:Request){
  if(!studioEnabled())throw new StudioError('DISABLED','Studio not found.',404);
  const admin=await getAuthUser(request,'admin');
  if(!admin)throw new StudioError('ADMIN_REQUIRED','Sign in to the boutique studio to continue.',401);
  return admin;
}
export function dailyLimit(){const n=Number(process.env.AI_STUDIO_DAILY_LIMIT||8);return Number.isInteger(n)&&n>=1&&n<=100?n:8;}
