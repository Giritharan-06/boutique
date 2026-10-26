import BrandMark from './brand-mark';

export default function Brand({tagline}:{tagline?:string}){
  return <a href="/" className="brand brand-lockup" aria-label="Aarini boutique home">
    <BrandMark/>
    <span className="brand-wordmark">AARINI{tagline&&<small className="brand-tagline">{tagline}</small>}</span>
  </a>;
}
