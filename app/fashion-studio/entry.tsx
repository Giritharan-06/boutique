'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Sparkles} from 'lucide-react';
export default function FashionStudioEntry(){const [enabled,setEnabled]=useState(false);useEffect(()=>{const controller=new AbortController();fetch('/api/fashion-studio/access',{signal:controller.signal,cache:'no-store'}).then(r=>{if(r.ok&&!controller.signal.aborted)setEnabled(true);}).catch(()=>{});return()=>controller.abort();},[]);return enabled?<div style={{display:'flex',justifyContent:'center',gap:12,flexWrap:'wrap',marginTop:15}}><span className="badge">Private admin testing</span><a className="text-link" href="/crm/fashion-studio"><Sparkles size={15}/>Open Fashion Studio<ArrowUpRight size={15}/></a></div>:null;}
