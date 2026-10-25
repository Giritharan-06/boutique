import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {initialShop} from '../../model';
export const dynamic='force-dynamic';
const vars=()=>env as unknown as Record<string,any>;
export async function GET(){return Response.json({connected:Boolean(vars().TRYON_API_URL&&vars().TRYON_API_KEY)},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){
 const u=await getChatGPTUser();if(!u)return Response.json({error:'Sign in to generate a preview.'},{status:401});
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin.'},{status:403});
 if(!vars().TRYON_API_URL||!vars().TRYON_API_KEY)return Response.json({error:'AI generation is not connected yet. Your photo stays in this browser. You can still compare outfits below.'},{status:503});
 try{const raw=await req.text();if(raw.length>7100000)return Response.json({error:'Choose a photo under 5 MB.'},{status:413});const b=JSON.parse(raw);
 if(b.consent!==true||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.photo)||!['S','M','L','XL'].includes(b.size))return Response.json({error:'Choose a JPG, PNG or WebP photo and allow processing.'},{status:400});
 const row=await env.DB!.prepare('SELECT data FROM shops WHERE owner = ?').bind(u.userId).first<{data:string}>();const garment=(row?JSON.parse(row.data):initialShop).products.find((p:any)=>p.id===b.product);
 if(!garment)return Response.json({error:'Outfit not found.'},{status:400});
 const upstream=await fetch(vars().TRYON_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+vars().TRYON_API_KEY},body:JSON.stringify({photo:b.photo,garment:{...garment,image:new URL('/campaign.png',req.url).href},size:b.size}),signal:AbortSignal.timeout(60000)});
 if(!upstream.ok)throw Error('Preview service unavailable.');const r:any=await upstream.json();if(typeof r.imageUrl!=='string'||!/^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(r.imageUrl))throw Error('Invalid preview.');
 return Response.json({imageUrl:r.imageUrl},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Unable to generate the preview. Please try again shortly.'},{status:502});}}
