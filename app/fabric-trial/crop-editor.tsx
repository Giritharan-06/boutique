'use client';
import {useRef} from 'react';
import {clampCrop,fullCrop} from './templates';
import type {CropRect,FabricImage} from './types';

export default function CropEditor({fabric,crop,onChange}:{fabric:FabricImage;crop:CropRect;onChange:(value:CropRect)=>void}){
  const start=useRef<{x:number;y:number}|null>(null);
  function point(event:React.PointerEvent<SVGSVGElement>){const rect=event.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};}
  return <div className="fabric-crop-editor">
    <div className="fabric-subheading"><strong>Choose your fabric area</strong><button type="button" className="text-link" onClick={()=>onChange({...fullCrop})}>Use full image</button></div>
    <p className="fine">Drag a rectangle over the image, or adjust the crop below.</p>
    <div className="fabric-crop-stage"><div className="fabric-crop-surface"><img src={fabric.url} alt="Uploaded fabric for cropping" draggable={false}/>
      <svg className="fabric-crop-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);start.current=point(event);}} onPointerMove={event=>{if(!start.current)return;const end=point(event);onChange(clampCrop({x:Math.min(start.current.x,end.x),y:Math.min(start.current.y,end.y),width:Math.abs(end.x-start.current.x),height:Math.abs(end.y-start.current.y)}));}} onPointerUp={event=>{start.current=null;event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={()=>{start.current=null;}}>
        <path d={`M0 0H1000V1000H0Z M${crop.x*1000} ${crop.y*1000}V${(crop.y+crop.height)*1000}H${(crop.x+crop.width)*1000}V${crop.y*1000}Z`} fill="#24172480" fillRule="evenodd"/>
        <rect x={crop.x*1000} y={crop.y*1000} width={crop.width*1000} height={crop.height*1000} fill="none" stroke="#fff9ef" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
      </svg>
    </div></div>
    <div className="fabric-crop-fields">{([{key:'x',name:'Crop left'},{key:'y',name:'Crop top'},{key:'width',name:'Crop width'},{key:'height',name:'Crop height'}] as const).map(field=><label key={field.key}>{field.name}<span><input type="number" min={field.key==='width'||field.key==='height'?5:0} max={100} step={1} value={Math.round(crop[field.key]*100)} onChange={event=>onChange(clampCrop({...crop,[field.key]:Number(event.target.value)/100}))}/>%</span></label>)}</div>
  </div>;
}
