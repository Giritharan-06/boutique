import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {initialShop,reduceShop,type Product,type Shop} from '../../app/model';
const root=join(process.cwd(),'.local');
const collectionImages:Record<string,string>={'Sarees':'sarees','Chudithar':'chudithar','Lehengas & Occasionwear':'occasionwear','Contemporary':'contemporary'};
function currentCatalogue(source:Shop):Shop{
 const saved=new Map(source.products.map(product=>[product.id,product]));
 const seedIds=new Set(initialShop.products.map(product=>product.id));
 const products=initialShop.products.map(seed=>{
  const old=saved.get(seed.id);
  if(!old)return seed;
  if(old.imageSet)return {...seed,...old,images:old.images||[]};
  return {...seed,price:old.price,stock:old.stock};
 });
 for(const old of source.products){
  if(seedIds.has(old.id))continue;
  const product:Product={...old,images:old.images||[],imageSet:old.imageSet||collectionImages[old.category]||'contemporary',imageIndex:Number.isInteger(old.imageIndex)?old.imageIndex:0,description:old.description||'A thoughtfully made piece for your wardrobe.',craft:old.craft||'Carefully finished details.',includes:old.includes||'One garment as pictured.',fit:old.fit||'Please consult the size guide for your best fit.',care:old.care||'Follow the garment care label.'};
  products.push(product);
 }
 return {...source,products};
}
function database(){
 mkdirSync(root,{recursive:true});
 const db=new DatabaseSync(join(root,'boutique.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS shop (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)');
 if(!db.prepare('SELECT id FROM shop WHERE id=1').get()){
  let initial:Shop=structuredClone(initialShop);
  const oldDir=join(process.cwd(),'.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  if(existsSync(oldDir))for(const name of readdirSync(oldDir).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite')){
   let old:DatabaseSync|undefined;
   try{old=new DatabaseSync(join(oldDir,name),{readOnly:true});const row=old.prepare('SELECT data FROM shops WHERE owner=?').get('local_seedy') as {data:string}|undefined;if(row){initial=JSON.parse(row.data);break;}}
   catch{}finally{old?.close();}
  }
  db.prepare('INSERT INTO shop(id,data,revision) VALUES(1,?,0)').run(JSON.stringify(currentCatalogue(initial)));
 }
 const row=db.prepare('SELECT data FROM shop WHERE id=1').get() as {data:string};
 const migrated=JSON.stringify(currentCatalogue(JSON.parse(row.data) as Shop));
 if(migrated!==row.data)db.prepare('UPDATE shop SET data=?,revision=revision+1 WHERE id=1').run(migrated);
 return db;
}
export function readShop(){const db=database();try{const row=db.prepare('SELECT data,revision FROM shop WHERE id=1').get() as {data:string;revision:number};return {shop:JSON.parse(row.data) as Shop,revision:row.revision,user:'Local boutique'};}finally{db.close();}}
export function updateShop(revision:number,action:unknown){const db=database();try{db.exec('BEGIN IMMEDIATE');const row=db.prepare('SELECT data,revision FROM shop WHERE id=1').get() as {data:string;revision:number};if(row.revision!==revision){db.exec('ROLLBACK');return null;}const shop=reduceShop(JSON.parse(row.data),action);db.prepare('UPDATE shop SET data=?, revision=revision+1 WHERE id=1').run(JSON.stringify(shop));db.exec('COMMIT');return {shop,revision:revision+1};}catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}}

export function registerCustomer(account:{id:string;name:string;email:string;phone:string}){const db=database();try{db.exec('BEGIN IMMEDIATE');const row=db.prepare('SELECT data FROM shop WHERE id=1').get() as {data:string};const shop=JSON.parse(row.data) as Shop;if(!shop.customers.some(customer=>customer.email.toLowerCase()===account.email.toLowerCase())){shop.customers.unshift({id:account.id,name:account.name,email:account.email,phone:account.phone,notes:'Online customer account'});db.prepare('UPDATE shop SET data=?,revision=revision+1 WHERE id=1').run(JSON.stringify(shop));}db.exec('COMMIT');}catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}}
