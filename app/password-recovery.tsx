'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,LockKeyhole} from 'lucide-react';
import Brand from './brand';
export default function PasswordRecovery({reset=false}:{reset?:boolean}){
  const [role,setRole]=useState<'customer'|'admin'>('customer'),[token,setToken]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[done,setDone]=useState(false);
  const initialized=useRef(false);
  useEffect(()=>{
    if(initialized.current)return;initialized.current=true;
    const params=new URLSearchParams(reset?window.location.hash.slice(1):window.location.search);
    setRole(params.get('role')==='admin'?'admin':'customer');setToken(params.get('token')||'');setReady(true);
    // Keep the recovery secret out of copied URLs, history and subsequent referrers.
    if(reset&&window.location.hash)window.history.replaceState(null,'',window.location.pathname);
  },[reset]);
  const login=role==='admin'?'/crm/login':'/login',forgot='/forgot-password?role='+role;
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;setError('');setMessage('');
    const fields=Object.fromEntries(new FormData(event.currentTarget)) as Record<string,string>;
    if(reset&&fields.password!==fields.confirm){setError('Those passwords do not match.');return;}
    setBusy(true);
    try{
      const response=await fetch('/api/auth/password-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reset?{action:'reset',role,token,password:fields.password}:{action:'request',role,email:fields.email})});
      const data=await response.json() as {message?:string;error?:string};
      if(!response.ok)throw Error(data.error||'Unable to complete password recovery. Try again later.');
      setMessage(data.message||'Request completed.');if(reset){setDone(true);setToken('');}
    }catch(error){setError(error instanceof Error?error.message:'Unable to connect. Please try again.');}finally{setBusy(false);}
  }
  return <main className="password-recovery"><header><Brand tagline="MADE FOR YOUR MOMENTS"/></header><section className="auth-form-card password-recovery-card"><a href={login} className="auth-back"><ArrowLeft size={15}/>Back to sign in</a><span className="eyebrow"><LockKeyhole size={14}/>{role==='admin'?'BOUTIQUE STUDIO':'YOUR AARINI ACCOUNT'}</span><h1>{done?'A fresh start.':reset?'Choose a new password.':'Forgot your password?'}</h1><p>{done?'Your other sign-in sessions have been closed for your security.':reset?'Use at least 10 characters for your new password.':'Enter your account email and we’ll send you a link to reset your password.'}</p>
    {ready&&reset&&!token&&!done?<p className="error" role="alert">Open the password reset link from your email, or request a new one below.</p>:!done&&<form onSubmit={submit}>
      {reset?<><label htmlFor="recovery-password">New password</label><input id="recovery-password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required disabled={busy}/><label htmlFor="recovery-confirm">Confirm new password</label><input id="recovery-confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} maxLength={128} required disabled={busy}/></>:<><label htmlFor="recovery-email">Email address</label><input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required disabled={busy}/></>}
      <button className="btn full" disabled={!ready||busy}>{busy?'Please wait…':reset?'Save new password':'Send reset link'}<ArrowRight size={16}/></button>
    </form>}
    {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="info-box" role="status"><Check size={15}/>{message}</p>}
    {reset&&!done&&<a className="text-link" href={forgot}>Request a new reset link</a>}{done&&<a className="btn full" href={login}>Continue to sign in<ArrowRight size={16}/></a>}
    <p className="auth-security"><LockKeyhole size={13}/>Reset links expire after 15 minutes and work once.</p></section></main>;
}
