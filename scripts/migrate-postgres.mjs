import {DatabaseSync} from 'node:sqlite';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {databaseRuntime} from './database-runtime.mjs';

const load=await databaseRuntime();
const {openDatabase,databaseMode,databaseTables,closeDatabasePool}=await load('database');
let source,target;
try{
  if(databaseMode()!=='postgres')throw Error('Set DATABASE_URL in .env.local first.');
  if(!existsSync('.local/boutique.sqlite'))throw Error('No existing SQLite database to migrate. Start the app to seed a new PostgreSQL store instead.');
  source=new DatabaseSync('.local/boutique.sqlite',{readOnly:true});source.exec('BEGIN');
  target=await openDatabase();await target.exec('BEGIN IMMEDIATE');
  for(const table of databaseTables){const row=await target.prepare('SELECT COUNT(*) AS count FROM '+table).get();if(row.count>0)throw Error('The Aarini PostgreSQL schema already has data. No records were overwritten.');}
  const counts={};
  for(const table of databaseTables){
    if(!source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))continue;
    const rows=source.prepare('SELECT * FROM '+table).all();counts[table]=rows.length;
    for(const row of rows){const columns=Object.keys(row);await target.prepare('INSERT INTO '+table+'('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+')').run(...columns.map(column=>row[column]));}
  }
  const images='.local/product-images';let imageCount=counts.product_images||0;
  if(existsSync(images))for(const file of readdirSync(images)){if(!/^[a-f0-9-]{36}\.jpg$/.test(file))continue;await target.prepare('INSERT OR IGNORE INTO product_images(id,data) VALUES(?,?)').run(file.slice(0,-4),readFileSync(join(images,file)));imageCount++;}
  counts.product_images=imageCount;
  await target.exec('COMMIT');source.exec('COMMIT');
  console.log(JSON.stringify({migrated:true,schema:'aarini',counts,localBackup:'SQLite database unchanged'}));
}catch(error){if(target)await target.exec('ROLLBACK').catch(()=>{});if(source)try{source.exec('ROLLBACK');}catch{}console.error('Migration stopped: '+(error.code?'database error '+error.code:error.message));process.exitCode=1;}finally{target?.close();source?.close();await closeDatabasePool();}
