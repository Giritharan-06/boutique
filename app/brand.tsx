export default function Brand({tagline}:{tagline?:string}){
  return <a href="/" className="brand brand-lockup" aria-label="Aarini boutique home">
    <img className="brand-mark" src="/aarini-mark.svg" alt="" width={44} height={44}/>
    <span className="brand-wordmark">AARINI{tagline&&<small className="brand-tagline">{tagline}</small>}</span>
  </a>;
}
