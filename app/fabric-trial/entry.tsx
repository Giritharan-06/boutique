'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Scissors} from 'lucide-react';

export default function FabricTrialEntry(){
  const [enabled,setEnabled]=useState(false);
  useEffect(()=>{const controller=new AbortController();fetch('/api/fabric-trial/access',{signal:controller.signal,cache:'no-store'}).then(async response=>{if(response.ok){const result=await response.json() as {enabled?:boolean};if(!controller.signal.aborted)setEnabled(result.enabled===true);}}).catch(()=>{});return()=>controller.abort();},[]);
  return enabled?<div className="fabric-trial-entry" style={{display:'flex',justifyContent:'center',alignItems:'center',gap:12,flexWrap:'wrap',marginTop:15}}><span className="badge">Admin trial</span><a className="text-link" href="/crm/fabric-trial"><Scissors size={15}/>Fabric-to-blouse studio<ArrowUpRight size={15}/></a></div>:null;
}
