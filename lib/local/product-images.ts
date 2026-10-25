import sharp from 'sharp';
import {mkdir,readFile,unlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {databaseMode,openDatabase} from './database';
const root=join(process.cwd(),'.local','product-images');
const pattern=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const safeId=(id:string)=>/^[a-f0-9-]{36}$/.test(id);
export async function saveProductImages(photos:unknown){
  if(!Array.isArray(photos)||photos.length>4)throw Error('Choose up to four product photos.');
  const d=databaseMode()==='postgres'?await openDatabase():null,urls:string[]=[];
  try{
    if(d)await d.exec('BEGIN IMMEDIATE');else await mkdir(root,{recursive:true});
    for(const value of photos){
      if(typeof value!=='string')throw Error('Choose JPG, PNG or WebP product photos.');
      const match=value.match(pattern);if(!match)throw Error('Choose JPG, PNG or WebP product photos.');
      const raw=Buffer.from(match[2],'base64');if(raw.length>2*1024*1024)throw Error('Each product photo must be under 2 MB.');
      const photo=await sharp(raw,{limitInputPixels:25_000_000}).rotate().resize({width:1500,height:1900,fit:'inside',withoutEnlargement:true}).jpeg({quality:84,mozjpeg:true}).toBuffer();
      const id=randomUUID();
      if(d)await d.prepare('INSERT INTO product_images(id,data) VALUES(?,?)').run(id,photo);else await writeFile(join(root,id+'.jpg'),photo,{flag:'wx'});
      urls.push('/api/product-images/'+id);
    }
    if(d)await d.exec('COMMIT');return urls;
  }catch(error){if(d)await d.exec('ROLLBACK').catch(()=>{});else await removeProductImages(urls);throw error;}finally{d?.close();}
}
export async function removeProductImages(urls:unknown){
  if(!Array.isArray(urls))return;
  const d=databaseMode()==='postgres'?await openDatabase():null;
  try{for(const value of urls){if(typeof value!=='string')continue;const match=value.match(/^\/api\/product-images\/([a-f0-9-]{36})$/);if(!match||!safeId(match[1]))continue;
    if(d)await d.prepare('DELETE FROM product_images WHERE id=?').run(match[1]);else await unlink(join(root,match[1]+'.jpg')).catch(()=>{});
  }}finally{d?.close();}
}
export async function readProductImage(id:string):Promise<Buffer|null>{
  if(!safeId(id))return null;
  if(databaseMode()==='postgres'){const d=await openDatabase();try{return (await d.prepare('SELECT data FROM product_images WHERE id=?').get(id))?.data??null;}finally{d.close();}}
  try{return await readFile(join(root,id+'.jpg'));}catch{return null;}
}
