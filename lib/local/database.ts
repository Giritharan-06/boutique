import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import pg from 'pg';

const root=join(process.cwd(),'.local');
export const databaseTables=['shop','accounts','sessions','commerce_settings','customer_profiles','customer_access','preview_usage','ai_purchases','product_images'] as const;
const schema=`
CREATE TABLE IF NOT EXISTS shop(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,phone TEXT NOT NULL DEFAULT '',role TEXT NOT NULL CHECK(role IN ('admin','customer')),salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at BIGINT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_lower ON accounts(lower(email));
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS commerce_settings(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS customer_profiles(account_id TEXT PRIMARY KEY,address TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS customer_access(account_id TEXT PRIMARY KEY,free_limit INTEGER,enabled INTEGER NOT NULL DEFAULT 1,wallet INTEGER NOT NULL DEFAULT 0,plan_credits INTEGER NOT NULL DEFAULT 0,plan_until BIGINT NOT NULL DEFAULT 0,plan_name TEXT NOT NULL DEFAULT '',ending INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS preview_usage(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,period TEXT NOT NULL,source TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL,created_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS preview_usage_account ON preview_usage(account_id,period,status);
CREATE TABLE IF NOT EXISTS ai_purchases(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,credits INTEGER NOT NULL,price INTEGER NOT NULL,days INTEGER NOT NULL,status TEXT NOT NULL,created_at BIGINT NOT NULL,confirmed_at BIGINT);
CREATE TABLE IF NOT EXISTS product_images(id TEXT PRIMARY KEY,data BYTEA NOT NULL);
`;
type Params=(string|number|bigint|null|Uint8Array)[];
export interface Database{
  dialect:'sqlite'|'postgres';
  exec(sql:string):Promise<void>;
  prepare(sql:string):{get(...params:Params):Promise<any>;all(...params:Params):Promise<any[]>;run(...params:Params):Promise<{changes:number}>};
  close():void;
}
const state=globalThis as typeof globalThis & {aariniPg?:pg.Pool;aariniPgReady?:Promise<void>};
pg.types.setTypeParser(20,(value:string)=>Number(value));
let sqliteQueue:Promise<void>=Promise.resolve();

export function databaseMode(){return process.env.DATABASE_URL?'postgres':'sqlite';}
export function postgresPool(){
  if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is not configured.');
  if(!state.aariniPg){
    const url=new URL(process.env.DATABASE_URL);
    if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('Use a PostgreSQL connection URL.');
    // Keep certificate verification on. Connection-string SSL options must not
    // replace pg's TLS configuration or leak into client-facing errors.
    for(const key of ['sslmode','sslcert','sslkey','sslrootcert','channel_binding'])url.searchParams.delete(key);
    state.aariniPg=new pg.Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},enableChannelBinding:true,max:8,connectionTimeoutMillis:15000,idleTimeoutMillis:30000,allowExitOnIdle:true});
    state.aariniPg.on('error',()=>console.error('A database connection was interrupted.'));
  }
  return state.aariniPg;
}
async function initializePostgres(){
  const client=await postgresPool().connect();
  try{
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('aarini-schema-v1'))");
    await client.query('CREATE SCHEMA IF NOT EXISTS aarini');
    await client.query('SET LOCAL search_path TO aarini, public');
    await client.query(schema);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}
export function postgresSql(sql:string){
  const ignore=/^\s*INSERT OR IGNORE INTO/i.test(sql);
  let converted=sql.replace(/^\s*INSERT OR IGNORE INTO/i,'INSERT INTO');
  // Preserve string literals and quoted identifiers while converting parameters.
  let parameter=0;
  converted=converted.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,token=>token==='?'?'$'+(++parameter):token);
  converted=converted.replace(/\bAS\s+(accountId|createdAt|confirmedAt)\b/g,'AS "$1"');
  // Neon's transaction pooler does not preserve session SET search_path.
  // Qualify every table reference instead of depending on connection state.
  converted=converted.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\b(FROM|JOIN|UPDATE|INTO)\s+(shop|accounts|sessions|commerce_settings|customer_profiles|customer_access|preview_usage|ai_purchases|product_images)\b/gi,(token,keyword,table)=>keyword?keyword+' "aarini"."'+table.toLowerCase()+'"':token);
  if(ignore)converted=converted.replace(/;?\s*$/,' ON CONFLICT DO NOTHING');
  return converted;
}
export async function openDatabase():Promise<Database>{
  if((process.env.VERCEL==='1'||process.env.APP_ORIGIN)&&!process.env.DATABASE_URL)throw Error('Database connection is not configured. Add DATABASE_URL to the server environment.');
  if(databaseMode()==='sqlite'){
    const previous=sqliteQueue;
    let unlock!:()=>void;
    sqliteQueue=new Promise<void>(resolve=>{unlock=resolve;});
    await previous;
    let client:DatabaseSync;
    try{
    mkdirSync(root,{recursive:true});
    client=new DatabaseSync(join(root,'boutique.sqlite'));
    client.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;'+schema.replace('data BYTEA','data BLOB'));
    }catch(error){unlock();throw error;}
    let closed=false;
    return {dialect:'sqlite',async exec(sql){client.exec(sql);},prepare(sql){const statement=client.prepare(sql);return {async get(...values){return statement.get(...values);},async all(...values){return statement.all(...values);},async run(...values){return {changes:Number(statement.run(...values).changes)};}};},close(){if(!closed){closed=true;try{client.close();}finally{unlock();}}}};
  }
  state.aariniPgReady??=initializePostgres().catch(error=>{state.aariniPgReady=undefined;throw error;});
  await state.aariniPgReady;
  const client=await postgresPool().connect();
  let closed=false;
  return {dialect:'postgres',async exec(sql){
    if(sql==='BEGIN IMMEDIATE'){
      await client.query('BEGIN');
      // The existing shop aggregate and credit ledger must be updated atomically.
      // Serialize these short writes across processes, as SQLite did locally.
      await client.query("SELECT pg_advisory_xact_lock(hashtext('aarini-write-v1'))");
    }else await client.query(sql);
  },prepare(sql){const query=postgresSql(sql);return {async get(...values){return (await client.query(query,values)).rows[0];},async all(...values){return (await client.query(query,values)).rows;},async run(...values){return {changes:(await client.query(query,values)).rowCount??0};}};},close(){if(!closed){closed=true;client.release();}}};
}
export async function closeDatabasePool(){if(state.aariniPg){await state.aariniPg.end();delete state.aariniPg;delete state.aariniPgReady;}}
