'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Download,Loader2,RotateCcw,RotateCw,Scissors,ShieldCheck,Trash2} from 'lucide-react';
import Brand from '../brand';
import ImageUpload from '../image-upload';
import CropEditor from './crop-editor';
import {decodeFabricFile} from './images';
import {BrowserFabricRenderer,drawComparison} from './renderer';
import {downloadPreview} from './export';
import {blouseTemplates,defaultAlignment,defaultTexture,fullCrop,referenceModel,templateById} from './templates';
import type {Alignment,BlouseDesignId,ComparisonMode,CropRect,FabricImage,RenderedPreview,TextureSettings} from './types';

function RangeControl({id,label,value,min,max,step=1,suffix='',onChange}:{id:string;label:string;value:number;min:number;max:number;step?:number;suffix?:string;onChange:(value:number)=>void}){
  return <div className="fabric-range"><label htmlFor={'fabric-'+id}><span>{label}</span><output aria-hidden="true">{Number(value.toFixed(2))}{suffix}</output></label><input id={'fabric-'+id} type="range" min={min} max={max} step={step} value={value} onChange={event=>onChange(Number(event.target.value))}/></div>;
}

export default function FabricTrialStudio(){
  const [fabric,setFabric]=useState<FabricImage|null>(null),[design,setDesign]=useState<BlouseDesignId>('boat-neck');
  const [crop,setCrop]=useState<CropRect>({...fullCrop}),[texture,setTexture]=useState<TextureSettings>({...defaultTexture}),[alignment,setAlignment]=useState<Alignment>({...defaultAlignment});
  const [guides,setGuides]=useState(false),[comparison,setComparison]=useState<ComparisonMode>('after'),[split,setSplit]=useState(50);
  const [result,setResult]=useState<RenderedPreview|null>(null),[uploading,setUploading]=useState(false),[rendering,setRendering]=useState(false),[exporting,setExporting]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('Add a fabric image to begin.');
  const current=useRef<FabricImage|null>(null),uploadVersion=useRef(0),preview=useRef<HTMLCanvasElement>(null);
  const renderer=useMemo(()=>new BrowserFabricRenderer(),[]),template=templateById(design);
  const busy=uploading||rendering||exporting;
  const reset=useCallback(()=>{setCrop({...fullCrop});setTexture({...defaultTexture});setAlignment({...defaultAlignment});setGuides(false);setComparison('after');setSplit(50);setError('');},[]);
  useEffect(()=>()=>{uploadVersion.current++;current.current?.dispose();},[]);
  async function openFile(file?:File){
    if(!file)return;
    const version=++uploadVersion.current;setUploading(true);setError('');setStatus('Opening your fabric…');
    try{const next=await decodeFabricFile(file);if(version!==uploadVersion.current){next.dispose();return;}current.current?.dispose();current.current=next;setFabric(next);setResult(null);reset();}
    catch(error){if(version===uploadVersion.current){setError(error instanceof Error?error.message:'Unable to open this fabric.');setStatus('Choose another fabric image.');}}
    finally{if(version===uploadVersion.current)setUploading(false);}
  }
  function removeFabric(){uploadVersion.current++;current.current?.dispose();current.current=null;setFabric(null);setResult(null);setUploading(false);setRendering(false);reset();setStatus('Add a fabric image to begin.');}
  async function useSample(){
    setUploading(true);setError('');
    try{const response=await fetch('/fabric-trial/sample-fabric.png');if(!response.ok)throw Error('Sample fabric is unavailable. Upload your own image.');await openFile(new File([await response.blob()],'sample-fabric.png',{type:'image/png'}));}
    catch(error){setError(error instanceof Error?error.message:'Sample fabric could not be opened.');setUploading(false);}
  }
  useEffect(()=>{
    if(!fabric)return;
    const controller=new AbortController();setRendering(true);setStatus('Mapping fabric to your blouse…');
    const frame=requestAnimationFrame(()=>{renderer.render({model:referenceModel,template,fabric,crop,texture,alignment,seamGuides:guides},controller.signal).then(next=>{if(!controller.signal.aborted){setResult(next);setError('');setStatus('Preview ready. Your fabric stays in this browser.');}}).catch(error=>{if(!controller.signal.aborted){setResult(null);setError(error instanceof Error?error.message:'Unable to render this preview.');setStatus('Preview could not be prepared.');}}).finally(()=>{if(!controller.signal.aborted)setRendering(false);});});
    return()=>{controller.abort();cancelAnimationFrame(frame);};
  },[fabric,design,crop,texture,alignment,guides,renderer]);
  useEffect(()=>{if(!result||!preview.current)return;try{drawComparison(preview.current,result,comparison,split);}catch(error){setError(error instanceof Error?error.message:'Unable to display the preview.');}},[result,comparison,split]);
  function textureValue<K extends keyof TextureSettings>(key:K,value:TextureSettings[K]){setTexture(current=>({...current,[key]:value}));}
  function alignmentValue<K extends keyof Alignment>(key:K,value:Alignment[K]){setAlignment(current=>({...current,[key]:value}));}
  async function download(){if(!result||busy)return;setExporting(true);setError('');try{await downloadPreview(result,design);setStatus('PNG downloaded with the model and mapped blouse.');}catch(error){setError(error instanceof Error?error.message:'Download failed. Please try again.');}finally{setExporting(false);}}

  return <main className="fabric-trial">
    <header className="fabric-trial-header"><Brand tagline="THE BOUTIQUE STUDIO"/><a href="/crm" className="text-link"><ArrowLeft size={15}/>Back to studio</a></header>
    <div className="fabric-trial-shell">
      <div className="fabric-trial-intro"><span className="eyebrow"><Scissors size={15}/> THE FABRIC ATELIER</span><h1>A swatch. A silhouette.<br/><em>A little possibility.</em></h1><p>Explore your fabric in four blouse shapes before you begin a conversation with your tailor.</p><span className="badge"><ShieldCheck size={13}/> Admin-only trial · Phase 1</span></div>
      <aside className="fabric-prototype-note"><strong>A fabric overlay, not an AI fitting.</strong><span>This trial uses an illustrated placeholder model and matching flat masks. It does not predict drape, body fit or tailoring measurements. Your fabric is processed in this browser and does not use AI credits.</span></aside>
      <div className="fabric-trial-grid">
        <div className="fabric-inputs">
          <section className="fabric-panel fabric-reference"><img src={referenceModel.url} alt="Fixed illustrated female reference model wearing a neutral base outfit" width={768} height={1024}/><div><span className="eyebrow">01 · THE REFERENCE</span><h2>Your starting point.</h2><p>One fixed, front-facing illustrated model. All four templates share its alignment coordinates.</p><span className="fabric-placeholder-tag">Placeholder asset</span></div></section>
          <section className="fabric-panel"><span className="eyebrow">02 · YOUR FABRIC</span><h2>Start with a swatch.</h2><ImageUpload label={fabric?'Change fabric image':'Upload fabric image'} disabled={uploading} onFile={file=>void openFile(file)}/><div className="fabric-upload-actions"><button type="button" className="text-link" disabled={uploading} onClick={()=>void useSample()}>Try the sample fabric</button>{fabric&&<button type="button" className="text-link" disabled={uploading} onClick={removeFabric}><Trash2 size={13}/>Remove fabric</button>}</div>{fabric&&<><p className="fabric-file-name">{fabric.name} · {fabric.originalWidth} × {fabric.originalHeight}</p><CropEditor fabric={fabric} crop={crop} onChange={setCrop}/></>}</section>
          <section className="fabric-panel"><span className="eyebrow">03 · THE SILHOUETTE</span><fieldset className="fabric-designs"><legend>Choose a blouse design</legend><div className="fabric-design-grid">{blouseTemplates.map(item=><label className={'fabric-design '+(design===item.id?'selected':'')} key={item.id}><input className="fabric-design-radio" type="radio" name="blouse-design" value={item.id} checked={design===item.id} onChange={()=>setDesign(item.id)}/><img src={item.thumbnailUrl} alt="" width={320} height={230}/><strong>{item.name}</strong><small>{item.description}</small></label>)}</div></fieldset></section>
        </div>
        <div className="fabric-output">
          <section className="fabric-panel fabric-preview-panel"><div className="fabric-preview-heading"><div><span className="eyebrow">YOUR FABRIC STUDY</span><h2>{template.name}</h2></div><span className="fabric-local-badge">Browser preview</span></div>
            <div className="fabric-comparison" role="group" aria-label="Before and after comparison">{([{id:'before',label:'Original'},{id:'after',label:'Mapped blouse'},{id:'split',label:'Compare'}] as const).map(mode=><button type="button" key={mode.id} aria-pressed={comparison===mode.id} disabled={!result} className={comparison===mode.id?'active':''} onClick={()=>setComparison(mode.id)}>{mode.label}</button>)}</div>
            <div className="fabric-preview-stage" aria-busy={uploading||rendering}>{result?<canvas ref={preview} width={768} height={1024} role="img" aria-label={`${template.name} with ${fabric?.name||'fabric'} on an illustrated reference model`}/>:<img src={referenceModel.url} alt="Illustrated reference model before fabric mapping" width={768} height={1024}/>}<span className="fabric-preview-label">{comparison==='before'?'Original reference':comparison==='split'?'Original ← → Fabric overlay':'Fabric overlay prototype'}</span>{(uploading||rendering)&&<div className="fabric-loading"><Loader2 size={22} className="fabric-spinner"/><span>{uploading?'Opening fabric…':'Updating fabric…'}</span></div>}</div>
            {comparison==='split'&&result&&<RangeControl id="comparison" label="Comparison divider" value={split} min={0} max={100} suffix="%" onChange={setSplit}/>}
            <p className="fabric-render-status" role="status">{status}</p>{error&&<p className="error" role="alert">{error}</p>}
            <div className="fabric-export-actions"><button type="button" className="btn outline" disabled={!fabric||uploading} onClick={reset}><RotateCcw size={15}/>Reset adjustments</button><button type="button" className="btn" disabled={!result||busy||Boolean(error)} onClick={()=>void download()}>{exporting?<Loader2 size={15}/>:<Download size={15}/>}Download PNG</button></div>
            <p className="fine">Download always exports the full mapped blouse, including when Original or Compare is selected.</p>
          </section>
          <section className="fabric-panel fabric-adjustments"><span className="eyebrow">04 · MAKE IT YOURS</span><h2>Place the pattern.</h2><fieldset disabled={!fabric||uploading}><legend className="fabric-sr-only">Fabric texture adjustments</legend><RangeControl id="scale" label="Fabric scale" value={texture.scale} min={.25} max={3} step={.05} suffix="×" onChange={value=>textureValue('scale',value)}/><RangeControl id="rotation" label="Fabric rotation" value={texture.rotation} min={-180} max={180} suffix="°" onChange={value=>textureValue('rotation',value)}/><button type="button" className="text-link" onClick={()=>textureValue('rotation',texture.rotation>=90?texture.rotation-270:texture.rotation+90)}><RotateCw size={14}/>Rotate 90°</button><div className="fabric-control-pair"><RangeControl id="position-x" label="Fabric horizontal position" value={texture.x} min={-200} max={200} suffix=" px" onChange={value=>textureValue('x',value)}/><RangeControl id="position-y" label="Fabric vertical position" value={texture.y} min={-200} max={200} suffix=" px" onChange={value=>textureValue('y',value)}/></div><label className="fabric-check"><input type="checkbox" checked={texture.repeat} onChange={event=>textureValue('repeat',event.target.checked)}/>Repeat fabric pattern</label><label className="fabric-check"><input type="checkbox" checked={guides} onChange={event=>setGuides(event.target.checked)}/>Show seam guides</label><p className="fine">No colour filters are applied. In single-swatch mode, moving the fabric may leave part of the template uncovered.</p>
            <details className="fabric-alignment"><summary>Adjust blouse alignment</summary><p className="fine">Small positioning corrections for this reference model. This does not measure or reshape the body.</p><div className="fabric-control-pair"><RangeControl id="alignment-x" label="Blouse horizontal position" value={alignment.x} min={-60} max={60} suffix=" px" onChange={value=>alignmentValue('x',value)}/><RangeControl id="alignment-y" label="Blouse vertical position" value={alignment.y} min={-40} max={40} suffix=" px" onChange={value=>alignmentValue('y',value)}/></div><RangeControl id="alignment-scale" label="Blouse size adjustment" value={alignment.scale} min={.85} max={1.15} step={.01} suffix="×" onChange={value=>alignmentValue('scale',value)}/><RangeControl id="alignment-rotation" label="Blouse angle" value={alignment.rotation} min={-8} max={8} step={.5} suffix="°" onChange={value=>alignmentValue('rotation',value)}/></details>
          </fieldset></section>
        </div>
      </div>
      <p className="fabric-trial-footer">Aarini fabric atelier · Experimental admin workspace · No fabric files are saved to your account or sent to a rendering service.</p>
    </div>
  </main>;
}
