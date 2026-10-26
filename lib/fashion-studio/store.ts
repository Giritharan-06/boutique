import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {openDatabase,type Database} from '../local/database';
import {StudioError,type StudioImage,type StudioJob,type ReferenceKind} from '../../app/fashion-studio/model';
import {dailyLimit} from './access';
export type StoredJob=StudioJob&{owner:string;remote?:{provider:'fashn'|'qwen'|'qwen2511'|'gateway';event:string;endpoint:string};sourceReferenceId?:string;designAssetId?:string;step:number;leaseUntil:number;expiresAt:number;idempotency:string;consent:true};
const ttl=20*60*1000;
const names=(d:Database)=>d.dialect==='postgres'?{jobs:'"aarini_fashion_studio"."jobs"',assets:'"aarini_fashion_studio"."assets"'}:{jobs:'fashion_studio_jobs',assets:'fashion_studio_assets'};
export function storageReady(){return /^[a-f0-9]{64}$/i.test(process.env.AI_STUDIO_IMAGE_KEY||'')||(!process.env.AI_STUDIO_IMAGE_KEY&&process.env.VERCEL!=='1'&&!process.env.APP_ORIGIN);}
function encryptionKey(){
  if(process.env.AI_STUDIO_IMAGE_KEY){if(!/^[a-f0-9]{64}$/i.test(process.env.AI_STUDIO_IMAGE_KEY))throw new StudioError('STORAGE_CONFIG','The temporary image encryption key needs configuration.',503);return Buffer.from(process.env.AI_STUDIO_IMAGE_KEY,'hex');}
  if(process.env.VERCEL==='1'||process.env.APP_ORIGIN)throw new StudioError('STORAGE_CONFIG','Configure the studio image encryption key before uploading.',503);
  const root=join(process.cwd(),'.local');mkdirSync(root,{recursive:true});const file=join(root,'fashion-image-key');
  try{writeFileSync(file,randomBytes(32),{flag:'wx',mode:0o600});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
  const key=readFileSync(file);if(key.length!==32)throw Error('Invalid temporary image key.');return key;
}
function encrypt(bytes:Buffer){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);return Buffer.concat([iv,cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);}
function decrypt(bytes:Buffer){const cipher=createDecipheriv('aes-256-gcm',encryptionKey(),bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(-16));return Buffer.concat([cipher.update(bytes.subarray(12,-16)),cipher.final()]);}
async function database(){
  const d=await openDatabase(),t=names(d);
  try{
    // Isolated experimental namespace. Existing account, shop and commerce schemas are untouched.
    await d.exec('BEGIN IMMEDIATE');
    if(d.dialect==='postgres')await d.exec('CREATE SCHEMA IF NOT EXISTS aarini_fashion_studio');
    await d.exec(`CREATE TABLE IF NOT EXISTS ${t.jobs}(id TEXT PRIMARY KEY,owner TEXT NOT NULL,created_at BIGINT NOT NULL,expires_at BIGINT NOT NULL,data TEXT NOT NULL)`);
    await d.exec(`CREATE TABLE IF NOT EXISTS ${t.assets}(id TEXT PRIMARY KEY,owner TEXT NOT NULL,expires_at BIGINT NOT NULL,metadata TEXT NOT NULL,data ${d.dialect==='postgres'?'BYTEA':'BLOB'} NOT NULL)`);
    await d.exec('COMMIT');return d;
  }catch(error){await d.exec('ROLLBACK').catch(()=>{});d.close();throw error;}
}
export async function saveAsset(owner:string,bytes:Buffer,meta:Omit<StudioImage,'id'|'url'|'expiresAt'>,jobId?:string){
  const id=randomUUID(),expiresAt=Date.now()+ttl,asset:StudioImage={...meta,id,expiresAt,url:'/api/fashion-studio/images/'+id};const encrypted=encrypt(bytes),d=await database();
  try{const t=names(d);await d.exec('BEGIN IMMEDIATE');
    if(jobId){const row=await d.prepare(`SELECT data FROM ${t.jobs} WHERE id=? AND owner=?`).get(jobId,owner);if(!row||!['submitting','queued','running'].includes(JSON.parse(row.data).status))throw new StudioError('CANCELLED','This job is no longer active.',409);}
    const count=await d.prepare(`SELECT COUNT(*) AS total FROM ${t.assets} WHERE owner=?`).get(owner);if(Number(count.total)>=40)throw new StudioError('UPLOAD_LIMIT','Temporary image limit reached. Delete your temporary images first.',429);
    await d.prepare(`INSERT INTO ${t.assets}(id,owner,expires_at,metadata,data) VALUES(?,?,?,?,?)`).run(id,owner,expiresAt,JSON.stringify(asset),encrypted);await d.exec('COMMIT');return asset;
  }catch(error){await d.exec('ROLLBACK').catch(()=>{});throw error;}finally{d.close();}
}
export async function readAsset(id:string,owner:string){
  const d=await database();try{const row=await d.prepare(`SELECT metadata,data FROM ${names(d).assets} WHERE id=? AND owner=? AND expires_at>?`).get(id,owner,Date.now());return row?{asset:JSON.parse(row.metadata) as StudioImage,bytes:decrypt(Buffer.from(row.data))}:null;}finally{d.close();}
}
export async function deleteAsset(id:string,owner:string){const d=await database();try{await d.prepare(`DELETE FROM ${names(d).assets} WHERE id=? AND owner=?`).run(id,owner);}finally{d.close();}}
export async function listJobs(owner:string){const d=await database();try{const rows=await d.prepare(`SELECT data FROM ${names(d).jobs} WHERE owner=? ORDER BY created_at DESC LIMIT 60`).all(owner);return rows.map(row=>JSON.parse(row.data) as StoredJob);}finally{d.close();}}
export async function readStoredJob(id:string,owner:string){const d=await database();try{const row=await d.prepare(`SELECT data FROM ${names(d).jobs} WHERE id=? AND owner=?`).get(id,owner);return row?JSON.parse(row.data) as StoredJob:null;}finally{d.close();}}
export async function createStoredJob(job:StoredJob){
  const d=await database();try{const t=names(d);await d.exec('BEGIN IMMEDIATE');
    const rows=await d.prepare(`SELECT data FROM ${t.jobs} WHERE owner=? AND created_at>=?`).all(job.owner,new Date().setUTCHours(0,0,0,0));const jobs=rows.map(r=>JSON.parse(r.data) as StoredJob);
    const duplicate=jobs.find(j=>j.idempotency===job.idempotency);if(duplicate){await d.exec('COMMIT');return duplicate;}
    const units=jobs.reduce((sum,j)=>sum+(j.action==='concepts'?j.designs.length:1),0),needed=job.action==='concepts'?job.designs.length:1;
    if(units+needed>dailyLimit())throw new StudioError('LIMIT_REACHED','Daily studio generation limit reached.',429);
    if(jobs.some(j=>['queued','running','submitting'].includes(j.status)&&j.expiresAt>Date.now()))throw new StudioError('BUSY','Another studio job is active. Finish or cancel it first.',409);
    await d.prepare(`INSERT INTO ${t.jobs}(id,owner,created_at,expires_at,data) VALUES(?,?,?,?,?)`).run(job.id,job.owner,job.createdAt,job.expiresAt,JSON.stringify(job));await d.exec('COMMIT');return job;
  }catch(error){await d.exec('ROLLBACK').catch(()=>{});throw error;}finally{d.close();}
}
export async function updateJob(id:string,owner:string,update:(job:StoredJob)=>StoredJob){
  const d=await database();try{await d.exec('BEGIN IMMEDIATE');const t=names(d),row=await d.prepare(`SELECT data FROM ${t.jobs} WHERE id=? AND owner=?`).get(id,owner);if(!row){await d.exec('COMMIT');return null;}
    const next=update(JSON.parse(row.data));await d.prepare(`UPDATE ${t.jobs} SET data=? WHERE id=? AND owner=?`).run(JSON.stringify(next),id,owner);await d.exec('COMMIT');return next;
  }catch(error){await d.exec('ROLLBACK').catch(()=>{});throw error;}finally{d.close();}
}
export async function cleanupStudio(){const d=await database();try{const t=names(d),now=Date.now();await d.prepare(`DELETE FROM ${t.assets} WHERE expires_at<=?`).run(now);await d.prepare(`DELETE FROM ${t.jobs} WHERE created_at<?`).run(now-30*86400000);}finally{d.close();}}
export async function eraseSessionImages(owner:string){const d=await database();try{await d.prepare(`DELETE FROM ${names(d).assets} WHERE owner=?`).run(owner);}finally{d.close();}}
export function publicJob(job:StoredJob):StudioJob{const {owner,remote,step,leaseUntil,expiresAt,idempotency,consent,sourceReferenceId,designAssetId,...safe}=job;return {...safe,elapsedMs:Math.max(0,(['queued','running','submitting'].includes(job.status)?Date.now():job.updatedAt)-job.createdAt)};}
