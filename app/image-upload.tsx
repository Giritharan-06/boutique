'use client';

import {useRef} from 'react';
import {Upload} from 'lucide-react';

export default function ImageUpload({label,detail='JPG, PNG or WebP · Up to 5 MB',disabled=false,onFile}:{label:string;detail?:string;disabled?:boolean;onFile:(file?:File)=>void}){
  const input=useRef<HTMLInputElement>(null);
  return <>
    <button type="button" className="upload-box" disabled={disabled} onClick={()=>input.current?.click()}><Upload size={24}/><strong>{label}</strong><span>{detail}</span></button>
    <input hidden ref={input} aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';onFile(file);}}/>
  </>;
}
