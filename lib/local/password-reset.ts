import {createHash,randomBytes,scryptSync} from 'node:crypto';
import {openDatabase} from './database';
type Role='admin'|'customer';
type SendReset=(email:string,url:string)=>Promise<void>;
export const resetMessage='If an account matches that email, a password reset link will arrive shortly. Check your spam folder too.';
export const resetUnavailable='Password recovery is temporarily unavailable. Please contact the boutique for help.';
const lifetime=15*60*1000,cooldown=60*1000;
const tokenHash=(token:string)=>'reset:'+createHash('sha256').update(token).digest('hex');
export function resetEmailConfigured(){return Boolean(process.env.RESEND_API_KEY&&process.env.PASSWORD_RESET_FROM&&process.env.PASSWORD_RESET_ORIGIN);}
export function resetOrigin(){
  const url=new URL(process.env.PASSWORD_RESET_ORIGIN||'');
  if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&process.env.VERCEL!=='1')))throw Error(resetUnavailable);
  return url.origin;
}
export async function sendResetEmail(email:string,url:string){
  if(!resetEmailConfigured())throw Error(resetUnavailable);
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.PASSWORD_RESET_FROM,to:[email],subject:'Reset your Aarini password',text:`A password reset was requested for your Aarini account.\n\n${url}\n\nThis link expires in 15 minutes and can only be used once. If you did not request it, you can ignore this email.`}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(resetUnavailable);
}
/** Separate namespace in the existing expiring-session store. Reset tokens cannot authenticate as login sessions. */
export async function requestPasswordReset(emailInput:string,role:Role,origin:string,send:SendReset=sendResetEmail){
  const email=emailInput.trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email address.');
  const d=await openDatabase();let token='',accountId='';
  try{
    await d.exec('BEGIN IMMEDIATE');
    await d.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    const account=await d.prepare('SELECT id,email FROM accounts WHERE email=? AND role=?').get(email,role);
    if(account){
      const recent=await d.prepare("SELECT token_hash FROM sessions WHERE account_id=? AND token_hash LIKE 'reset:%' AND expires_at>?").get(account.id,Date.now()+lifetime-cooldown);
      if(!recent){
        token=randomBytes(32).toString('base64url');accountId=account.id;
        await d.prepare("DELETE FROM sessions WHERE account_id=? AND token_hash LIKE 'reset:%'").run(account.id);
        await d.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)').run(tokenHash(token),account.id,Date.now()+lifetime);
      }
    }
    await d.exec('COMMIT');
  }catch(error){await d.exec('ROLLBACK').catch(()=>{});throw error;}finally{d.close();}
  if(token){
    const url=new URL('/reset-password',origin);url.hash=new URLSearchParams({token,role}).toString();
    try{await send(email,url.toString());}catch{
      const cleanup=await openDatabase();try{await cleanup.prepare('DELETE FROM sessions WHERE token_hash=? AND account_id=?').run(tokenHash(token),accountId);}finally{cleanup.close();}
      throw Error(resetUnavailable);
    }
  }
  return resetMessage;
}
export async function completePasswordReset(token:string,password:string,role:Role){
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('This reset link is invalid or has expired. Request a new link.');
  if(password.length<10||password.length>128)throw Error('Use a password between 10 and 128 characters.');
  const salt=randomBytes(16).toString('hex'),hash=scryptSync(password,salt,64).toString('hex');
  const d=await openDatabase();
  try{
    await d.exec('BEGIN IMMEDIATE');
    const account=await d.prepare('SELECT a.id FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND a.role=?').get(tokenHash(token),Date.now(),role);
    if(!account)throw Error('This reset link is invalid or has expired. Request a new link.');
    await d.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=?').run(salt,hash,account.id);
    await d.prepare('DELETE FROM sessions WHERE account_id=?').run(account.id);
    await d.exec('COMMIT');
  }catch(error){await d.exec('ROLLBACK').catch(()=>{});throw error;}finally{d.close();}
}
