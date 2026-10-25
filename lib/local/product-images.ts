import sharp from 'sharp';
import {mkdir,readFile,unlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const root=join(process.cwd(),'.local','product-images');
const pattern=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const safeId=(id:string)=>/^[a-f0-9-]{36}$/.test(id);
export async function saveProductImages(photos:unknown){if(!Array.isArray(photos)||photos.length>4)throw Error('Choose up to four product photos.');await mkdir(root,{recursive:true});const urls:string[]=[];try{for(const value of photos){if(typeof value!=='string')throw Error('Choose JPG, PNG or WebP product photos.');const match=value.match(pattern);if(!match)throw Error('Choose JPG, PNG or WebP product photos.');const raw=Buffer.from(match[2],'base64');if(raw.length>2*1024*1024)throw Error('Each product photo must be under 2 MB.');const photo=await sharp(raw,{limitInputPixels:25_000_000}).rotate().resize({width:1500,height:1900,fit:'inside',withoutEnlargement:true}).jpeg({quality:84,mozjpeg:true}).toBuffer();const id=randomUUID();await writeFile(join(root,id+'.jpg'),photo,{flag:'wx'});urls.push('/api/product-images/'+id);}return urls;}catch(e){await removeProductImages(urls);throw e;}}
export async function removeProductImages(urls:unknown){if(!Array.isArray(urls))return;for(const value of urls){if(typeof value!=='string')continue;const match=value.match(/^\/api\/product-images\/([a-f0-9-]{36})$/);if(match&&safeId(match[1]))await unlink(join(root,match[1]+'.jpg')).catch(()=>{});}}
export async function readProductImage(id:string){if(!safeId(id))return null;try{return await readFile(join(root,id+'.jpg'));}catch{return null;}}
