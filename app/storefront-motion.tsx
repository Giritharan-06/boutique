'use client';

import {useEffect,useRef} from 'react';
import {Flower2} from 'lucide-react';

const revealSelector='.occasions .section-intro,.occasion-card,.ai-banner,#collection>.section-intro,.collection-tools,.product-card,.tailoring-banner,footer>div,.fitting>.section-intro,.fitting-grid>div';

export default function StorefrontMotion(){
  const progress=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    let dispose=()=>{};
    function configure(){
      dispose();
      if(preference.matches)return;
      const root=document.querySelector('.app');
      if(!root||!('IntersectionObserver' in window))return;
      const registered=new Set<HTMLElement>();
      let scanFrame=0,scrollFrame=0;
      const reveal=(element:HTMLElement)=>{element.classList.add('is-revealed');observer.unobserve(element);};
      const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)reveal(entry.target as HTMLElement);},{threshold:.08,rootMargin:'0px 0px -24px 0px'});
      function scan(){
        for(const element of registered)if(!element.isConnected){observer.unobserve(element);registered.delete(element);}
        const fresh=Array.from(root!.querySelectorAll<HTMLElement>(revealSelector)).filter(element=>!registered.has(element));
        const above=fresh.map(element=>element.getBoundingClientRect().bottom<=0);
        fresh.forEach((element,index)=>{
          registered.add(element);
          const siblings=element.parentElement?.children;
          const position=siblings?Array.from(siblings).indexOf(element):0;
          element.style.setProperty('--reveal-delay',element.matches('.product-card,.occasion-card')?`${position%3*40}ms`:'0ms');
          element.dataset.scrollReveal='';
          if(above[index])reveal(element);else observer.observe(element);
        });
        updateScroll();
      }
      function updateScroll(){
        const scrollable=document.documentElement.scrollHeight-window.innerHeight;
        if(progress.current)progress.current.style.transform=`scaleX(${scrollable>0?Math.min(1,window.scrollY/scrollable):0})`;
        scrollFrame=0;
      }
      const onScroll=()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(updateScroll);};
      const onFocus=(event:FocusEvent)=>{if(event.target instanceof Element){const element=event.target.closest<HTMLElement>('[data-scroll-reveal]');if(element)reveal(element);}};
      const mutation=new MutationObserver(()=>{if(!scanFrame)scanFrame=requestAnimationFrame(()=>{scanFrame=0;scan();});});
      scan();
      mutation.observe(root,{childList:true,subtree:true});
      window.addEventListener('scroll',onScroll,{passive:true});
      window.addEventListener('resize',onScroll,{passive:true});
      root.addEventListener('focusin',onFocus as EventListener);
      dispose=()=>{
        observer.disconnect();mutation.disconnect();cancelAnimationFrame(scanFrame);cancelAnimationFrame(scrollFrame);
        window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll);root.removeEventListener('focusin',onFocus as EventListener);
        for(const element of registered){delete element.dataset.scrollReveal;element.classList.remove('is-revealed');element.style.removeProperty('--reveal-delay');}
        if(progress.current)progress.current.style.transform='scaleX(0)';
      };
    }
    configure();preference.addEventListener('change',configure);
    return()=>{dispose();preference.removeEventListener('change',configure);};
  },[]);
  useEffect(()=>{
    const header=document.querySelector<HTMLElement>('.store-header');
    if(!header)return;
    const measure=()=>document.documentElement.style.setProperty('--store-nav-height',`${header.getBoundingClientRect().height}px`);
    measure();
    const observer=new ResizeObserver(measure);observer.observe(header);
    return()=>{observer.disconnect();document.documentElement.style.removeProperty('--store-nav-height');};
  },[]);
  return <>
    <div className="storefront-intro" aria-hidden="true"><div className="intro-silk intro-silk-left"/><div className="intro-silk intro-silk-right"/><div className="intro-signature"><Flower2 size={30} strokeWidth={1}/><span>AARINI</span><small>MADE FOR YOUR MOMENTS</small></div></div>
    <div className="reading-progress" aria-hidden="true"><span ref={progress}/></div>
  </>;
}
