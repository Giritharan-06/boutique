const localHosts=new Set(['localhost','127.0.0.1','[::1]']);
export function hostedDeployment(){return process.env.VERCEL==='1'||Boolean(process.env.APP_ORIGIN);}
function deploymentOrigins(){
  const origins=new Set<string>();
  const configured=[process.env.APP_ORIGIN];
  if(process.env.VERCEL==='1')for(const key of ['VERCEL_URL','VERCEL_BRANCH_URL','VERCEL_PROJECT_PRODUCTION_URL']){const host=process.env[key];if(host)configured.push('https://'+host);}
  for(const value of configured){if(!value)continue;try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/')origins.add(url.origin);}catch{}}
  return origins;
}
export function appRequest(request:Request,write=false){
  const url=new URL(request.url),allowed=deploymentOrigins(),local=localHosts.has(url.hostname);
  let expectedOrigin=url.origin;
  if(!local&&!allowed.has(expectedOrigin))return false;
  // A managed reverse proxy can pass an internal localhost URL to Next.js.
  // Only use its forwarded host when it matches a configured deployment origin.
  if(local&&hostedDeployment()){
    const proxyHost=request.headers.get('x-forwarded-host')||request.headers.get('host');
    if(proxyHost&&!localHosts.has(proxyHost.split(':')[0])){
      const proxyOrigin='https://'+proxyHost;
      if(!allowed.has(proxyOrigin))return false;
      expectedOrigin=proxyOrigin;
    }
  }
  const origin=request.headers.get('origin');
  if(write&&!origin)return false;
  if(origin&&origin!==expectedOrigin)return false;
  if(write&&request.headers.get('sec-fetch-site')==='cross-site')return false;
  return true;
}
export async function boundedJson(request:Request,maxBytes:number){const declared=Number(request.headers.get('content-length')||0);if(declared>maxBytes)throw new Error('Request too large.');const reader=request.body?.getReader();if(!reader)throw new Error('Request body is required.');const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('Request too large.');}chunks.push(value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
