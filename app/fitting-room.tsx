'use client';

import {ArrowRight,Camera,Check,Sparkles,Trash2} from 'lucide-react';
import ImageUpload from './image-upload';
import FabricTrialEntry from './fabric-trial/entry';
import FashionStudioEntry from './fashion-studio/entry';
import type {Product} from './model';
import type {PreviewAccess} from './commerce-model';
type Props={products:Product[];product:Product;size:string;photo:string;preview:string;consent:boolean;generating:boolean;message:string;error:string;access:PreviewAccess|null;limited:boolean;signedIn:boolean;admin:boolean;onFile:(file?:File)=>void;onSelect:(id:string)=>void;onSize:(size:string)=>void;onConsent:(value:boolean)=>void;onDelete:()=>void;onGenerate:()=>void;onCancel:()=>void;onPrivacy:()=>void;onBuy:()=>void;onRefresh:()=>void};
export default function FittingRoom(props:Props){
  const {product,photo,preview,generating,access}=props;
  const limited=props.limited||Boolean(access&&(!access.enabled||access.available<1));
  const image=product.images?.[product.imageIndex]||`/collections/${product.imageSet}-${product.imageIndex+1}.jpg`;
  return <section className="fitting section simple-fitting"><div className="section-intro centered"><span className="eyebrow"><Sparkles size={14}/> YOUR VIRTUAL FITTING ROOM</span><h1>A little more you.</h1><p>Choose an outfit. Add your photo. Discover your look.</p>{props.admin&&<><FashionStudioEntry/><FabricTrialEntry/></>}</div><div className="fitting-grid"><div><div className="try-image"><img src={preview||photo||image} alt={preview?'Your virtual outfit preview':photo?'Your selected photo':product.name}/><span className="image-badge"><Sparkles size={13}/>{preview?'Your preview':photo?'Your photo':'Selected outfit'}</span>{photo&&<button className="delete-photo icon-btn" aria-label="Delete photo" disabled={generating} onClick={props.onDelete}><Trash2 size={17}/></button>}</div>{preview&&<p className="fine">A style preview. Colour, drape and fit may vary.</p>}</div><div className="fit-controls">
    <div className="fit-heading"><h3>Find your next look.</h3>{props.admin?<span className="badge">Studio</span>:access&&<span className="badge">{access.enabled?access.available+' previews left':'Limit reached'}</span>}</div>
    {!props.signedIn?<div className="fitting-signin"><Camera size={30}/><h3>Your fitting room awaits.</h3><p>Sign in to create your personal outfit preview.</p><a className="btn full" href="/login?next=fitting">Sign in to continue <ArrowRight size={16}/></a></div>:<>
      {limited?<div className="limit-panel" role="status"><Sparkles size={25}/><h3>Limit reached</h3><a href="/account?tab=credits" className="btn full">Buy credits <ArrowRight size={16}/></a><a className="text-link" href="/account?tab=credits">Explore plans</a></div>:<>
        <label className="field-label">Your outfit<select value={product.id} disabled={generating} onChange={event=>props.onSelect(event.target.value)}>{[...new Set(props.products.filter(product=>!product.archived).map(product=>product.category))].map(category=><optgroup key={category} label={category}>{props.products.filter(product=>!product.archived&&product.category===category).map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</optgroup>)}</select></label>
        <ImageUpload label={photo?'Change your photo':'Add a full-length photo'} disabled={generating} onFile={props.onFile}/>
        <div className="field-label">Your size</div><div className="sizes">{['S','M','L','XL'].map(size=><button key={size} disabled={generating} aria-pressed={props.size===size} className={props.size===size?'selected':''} onClick={()=>props.onSize(size)}>{size}</button>)}</div>
        <label className="consent"><input type="checkbox" disabled={generating} checked={props.consent} onChange={event=>props.onConsent(event.target.checked)}/>I agree to have my photo processed online to create this outfit preview.</label><button className="text-link photo-privacy-link" onClick={props.onPrivacy}>Photo privacy</button>
        {props.error&&<p className="error" role="alert">{props.error}</p>}
        <button className="btn full" disabled={generating||!photo||!props.consent||!props.admin&&!access} onClick={props.onGenerate}><Sparkles size={16}/>{generating?'Creating your look…':!props.admin&&!access?'Loading…':'Generate preview'}<ArrowRight size={16}/></button>
        {generating&&<><p className="preview-status" role="status">{props.message||'Creating your look…'}</p><button className="text-link" onClick={props.onCancel}>Cancel preview</button></>}
        {!props.admin&&!access&&<button className="text-link" onClick={props.onRefresh}>Refresh allowance</button>}
        {!props.admin&&<a className="text-link fitting-credit-link" href="/account?tab=credits">Buy credits or explore plans <ArrowRight size={13}/></a>}
      </>}
      <div className="fitting-buy"><div><strong>{product.name}</strong><small>₹{product.price.toLocaleString('en-IN')}</small></div><button className="btn outline compact" disabled={!product.stock||generating} onClick={props.onBuy}>Buy this outfit <ArrowRight size={14}/></button></div>
      <p className="privacy"><Check size={13}/>Your photo stays out of your public profile.</p>
    </>}
  </div></div></section>;
}
