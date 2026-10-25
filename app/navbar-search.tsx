'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Search,X} from 'lucide-react';
import type {Product} from './model';

export default function NavbarSearch({products,query,onQuery,onProduct,onBrowse}:{products:Product[];query:string;onQuery:(query:string)=>void;onProduct:(product:Product)=>void;onBrowse:()=>void}){
  const [open,setOpen]=useState(false);
  const container=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const term=query.trim().toLowerCase();
  const results=products.filter(product=>!product.archived&&[product.name,product.category,product.fabric].join(' ').toLowerCase().includes(term));
  useEffect(()=>{if(!open)return;input.current?.focus();function outside(event:PointerEvent){if(event.target instanceof Node&&!container.current?.contains(event.target))setOpen(false);}document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
  function close(){setOpen(false);trigger.current?.focus();}
  return <div ref={container} className="navbar-search" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close();}}}>
    <button ref={trigger} aria-label="Search boutique" aria-expanded={open} aria-controls="navbar-search-panel" className={'icon-btn '+(open?'active':'')} onClick={()=>setOpen(value=>!value)}><Search size={19}/>{term&&<i className="search-active-dot"/>}</button>
    {open&&<div id="navbar-search-panel" className="navbar-search-panel" role="search" aria-label="Boutique search">
      <form onSubmit={event=>{event.preventDefault();onBrowse();setOpen(false);}}><Search size={18}/><input ref={input} type="search" aria-label="Search outfits, collections or materials" placeholder="Search sarees, cotton, occasionwear…" value={query} onChange={event=>onQuery(event.target.value)}/>{query&&<button type="button" className="icon-btn" aria-label="Clear search" onClick={()=>{onQuery('');input.current?.focus();}}><X size={16}/></button>}<button type="button" className="icon-btn" aria-label="Close search" onClick={close}><X size={18}/></button></form>
      {!term?<p className="search-hint">Find something lovely by style, collection or fabric.</p>:<><div className="between search-result-heading"><span>{results.length} {results.length===1?'style':'styles'} found</span><button className="text-link" onClick={()=>{onBrowse();setOpen(false);}}>See all results <ArrowRight size={13}/></button></div>{results.length?<ul className="navbar-search-results">{results.slice(0,4).map(product=><li key={product.id}><button onClick={()=>{setOpen(false);onProduct(product);}} aria-label={'Open '+product.name}><img src={product.images?.[product.imageIndex]||'/collections/'+product.imageSet+'-'+(product.imageIndex+1)+'.jpg'} alt=""/><span><strong>{product.name}</strong><small>{product.category} · {product.fabric}</small></span><b>₹{product.price.toLocaleString('en-IN')}</b></button></li>)}</ul>:<p className="search-hint">No matching styles. Try a different fabric or collection.</p>}</>}
    </div>}
  </div>;
}
