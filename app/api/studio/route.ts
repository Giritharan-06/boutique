import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {initialShop,reduceShop} from '../../model';
export const dynamic='force-dynamic';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const u=await getChatGPTUser();if(!u)return json({error:'Sign in to save and manage your boutique.',signIn:true},401);try{const r=await env.DB!.prepare('SELECT data,revision FROM shops WHERE owner = ?').bind(u.userId).first<{data:string;revision:number}>();return json({shop:r?JSON.parse(r.data):initialShop,revision:r?.revision??0,user:u.displayName});}catch{return json({error:'The database is not available yet. Please try again shortly.'},503);}}
export async function POST(req:Request){
 const u=await getChatGPTUser();if(!u)return json({error:'Please sign in before saving.',signIn:true},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid request origin.'},403);
 try{const raw=await req.text();if(raw.length>100000)return json({error:'Request too large.'},413);const b=JSON.parse(raw),db=env.DB!;
 await db.prepare('INSERT OR IGNORE INTO shops (owner,data,revision) VALUES (?,?,0)').bind(u.userId,JSON.stringify(initialShop)).run();
 const r=await db.prepare('SELECT data,revision FROM shops WHERE owner = ?').bind(u.userId).first<{data:string;revision:number}>();
 if(!r||r.revision!==b.revision)return json({error:'Your boutique changed in another window. Refresh and try again.'},409);
 const shop=reduceShop(JSON.parse(r.data),b.action);
 const result=await db.prepare('UPDATE shops SET data = ?,revision = revision + 1 WHERE owner = ? AND revision = ?').bind(JSON.stringify(shop),u.userId,b.revision).run();
 if(result.meta.changes!==1)return json({error:'Another update arrived. Refresh and try again.'},409);
 return json({shop,revision:r.revision+1});
 }catch(e){return json({error:e instanceof Error?e.message:'Unable to save.'},400);}}
