'use client';

import {ArrowUpRight, Flower2, Sparkles} from 'lucide-react';

export default function HeroAtelier({onPreview}:{onPreview:()=>void}) {
  return <div className="hero-atelier">
    <div className="atelier-drape atelier-drape-wine" aria-hidden="true"/>
    <div className="atelier-drape atelier-drape-ivory" aria-hidden="true"/>
    <svg className="atelier-thread" viewBox="0 0 600 700" fill="none" aria-hidden="true"><path d="M55 652V290C55 5 545 5 545 290V652" pathLength="1"/></svg>
    <div className="atelier-moment"><div className="atelier-photo">
      <img className="atelier-portrait" src="/collections/occasionwear-1.jpg" alt="Full view of rose pink embroidered occasionwear" fetchPriority="high"/>
      <div className="atelier-photo-shade"/>
      <div className="atelier-photo-caption"><span>THE GULABI EDIT</span><strong>A little tradition.<br/>A little you.</strong></div>
    </div></div>
    <div className="atelier-story-tag" aria-hidden="true"><span>FROM THE STUDIO</span><strong>Woven with care.<br/>Worn your way.</strong><i/></div>
    <div className="atelier-seal" aria-hidden="true"><Flower2 size={25}/><span>ROOTED<br/>IN CRAFT</span></div>
    <button className="atelier-preview" onClick={onPreview}><span className="atelier-preview-icon"><Sparkles size={18}/></span><span>Imagine it on you<small>Your personal AI fitting room</small></span><ArrowUpRight size={18}/></button>
  </div>;
}
