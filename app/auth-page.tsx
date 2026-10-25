'use client';

import Brand from './brand';

import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,Eye,EyeOff,Flower2,LockKeyhole,ShieldCheck,Sparkles} from 'lucide-react';

type Role='customer'|'admin';
type AuthResponse={user?:{id:string;name:string;role:Role}|null;error?:string};
export default function AuthPage({role='customer'}:{role?:Role}) {
  const [mode,setMode]=useState<'signin'|'signup'>('signin');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[showPassword,setShowPassword]=useState(false);
  const admin=role==='admin';
  function destination(){const next=new URLSearchParams(window.location.search).get('next');return admin?'/crm':next==='account'?'/account':next==='credits'?'/account?tab=credits':['checkout','appointment','fitting'].includes(next||'')?'/?'+next+'=1':'/';}
  useEffect(()=>{let active=true;fetch('/api/auth?role='+role).then(r=>r.json() as Promise<AuthResponse>).then(data=>{if(active&&data.user)window.location.replace(destination());}).catch(()=>{});return()=>{active=false;};},[role,admin]);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const fields=Object.fromEntries(new FormData(event.currentTarget)) as Record<string,string>;
    setError('');
    if(mode==='signup'&&fields.password!==fields.confirmPassword){setError('Those passwords do not match.');return;}
    setBusy(true);
    try{const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,role,action:mode})});const data=await response.json() as AuthResponse;if(!response.ok||!data.user)throw Error(data.error||'Unable to sign in. Please try again.');window.location.assign(destination());}
    catch(err){setError(err instanceof Error?err.message:'Unable to sign in. Please try again.');setBusy(false);}
  }
  return <main className="auth-page">
    <section className="auth-story">
      <Brand tagline="MADE FOR YOUR MOMENTS"/>
      <div className="auth-story-photo" aria-hidden="true"/>
      <div className="auth-story-copy"><span className="eyebrow"><Flower2 size={16}/> THE AARINI CIRCLE</span><h2>{admin?<>Your craft.<br/>Your little world.</>:<>A wardrobe of<br/><em>beautiful moments.</em></>}</h2><p>{admin?'A thoughtful space for your collection, your customers and everything you’re growing.':'Thoughtfully chosen styles. A personal fitting room. A little more you, in every detail.'}</p><div className="auth-story-note"><Sparkles size={17}/><span>{admin?'Made for the people behind the boutique.':'Indian roots. Your own expression.'}</span></div></div>
      <div className="auth-story-flower" aria-hidden="true"><Flower2 size={130} strokeWidth={.5}/></div>
    </section>
    <section className="auth-form-section">
      <a href="/" className="auth-back"><ArrowLeft size={15}/>Back to boutique</a>
      <div className="auth-form-card">
        {admin&&<div className="auth-role-tabs" aria-label="Account type"><a href="/login" aria-current={!admin?'page':undefined} className={!admin?'active':''}>Customer</a><a href="/crm/login" aria-current={admin?'page':undefined} className={admin?'active':''}>Boutique studio</a></div>}
        <span className="eyebrow">{admin?<ShieldCheck size={14}/>:<Flower2 size={14}/>} {admin?'YOUR CREATIVE WORKSPACE':'YOUR PERSONAL AARINI'}</span>
        <h1>{mode==='signup'?(admin?'Make room to create.':'You belong here.'):'Lovely to see you.'}</h1>
        <p>{mode==='signup'?(admin?'Create an owner account to manage your boutique.':'Create your account for a more personal boutique experience.'):(admin?'Sign in to care for your boutique.':'Sign in to find your next favourite.')}</p>
        <div className="auth-switch"><button type="button" aria-pressed={mode==='signin'} className={mode==='signin'?'active':''} disabled={busy} onClick={()=>{setMode('signin');setError('');}}>Sign in</button><button type="button" aria-pressed={mode==='signup'} className={mode==='signup'?'active':''} disabled={busy} onClick={()=>{setMode('signup');setError('');}}>Create {admin?'admin ':''}account</button></div>
        <form onSubmit={submit}>
          {mode==='signup'&&<><label htmlFor="auth-name">Your name</label><input id="auth-name" name="name" autoComplete="name" required minLength={2} maxLength={100}/>{!admin&&<><label htmlFor="auth-phone">Phone for order updates</label><input id="auth-phone" name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={30}/></>}</>}
          <label htmlFor="auth-email">Email address</label><input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/>
          <label htmlFor="auth-password">Password</label><div className="password-input"><input id="auth-password" name="password" type={showPassword?'text':'password'} autoComplete={mode==='signup'?'new-password':'current-password'} placeholder="Enter your password" required minLength={10} maxLength={128}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
          {mode==='signup'&&<><label htmlFor="auth-confirm">Confirm password</label><input id="auth-confirm" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/><p className="auth-password-note"><Check size={12}/> Use at least 10 characters.</p></>}
          {error&&<p className="error" role="alert">{error}</p>}
          <button className="btn full" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create my account':admin?'Open my studio':'Sign in'}<ArrowRight size={16}/></button>
        </form>
        <p className="auth-security"><LockKeyhole size={13}/>{admin?'Owner access · Your boutique workspace':'A little care for your personal details'}</p>
        <p className="auth-bottom-note">{admin?'Customer accounts and studio accounts have separate access.':'New moments. Thoughtful details. Always Aarini.'}</p>
      </div>
      <span className="auth-copyright">© 2026 AARINI BOUTIQUE</span>
    </section>
  </main>;
}
