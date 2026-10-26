import type {CropRect,FabricImage} from './types';
import {clampCrop} from './templates';
export const fabricMimeTypes=['image/jpeg','image/png','image/webp'];
export function validateFabricFile(file:{type:string;size:number}){
  if(!fabricMimeTypes.includes(file.type))throw Error('Choose a JPG, PNG or WebP fabric image.');
  if(file.size===0)throw Error('This image is empty. Choose another fabric photo.');
  if(file.size>5*1024*1024)throw Error('Choose a fabric image under 5 MB.');
}
export function canvas2d(width:number,height:number){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw Error('Your browser does not support canvas previews. Try a recent browser.');
  return {canvas,context};
}
export function loadImage(url:string,signal?:AbortSignal):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{
    const image=new Image();
    const clean=()=>{image.onload=null;image.onerror=null;signal?.removeEventListener('abort',abort);};
    const abort=()=>{clean();image.src='';reject(new DOMException('Preview cancelled.','AbortError'));};
    image.onload=()=>{clean();resolve(image);};
    image.onerror=()=>{clean();reject(Error('This image could not be opened. Choose a valid JPG, PNG or WebP image.'));};
    if(signal?.aborted){abort();return;}
    signal?.addEventListener('abort',abort,{once:true});
    image.src=url;
  });
}
export async function decodeFabricFile(file:File):Promise<FabricImage>{
  validateFabricFile(file);
  const url=URL.createObjectURL(file);
  try{
    const image=await loadImage(url),width=image.naturalWidth,height=image.naturalHeight;
    if(width<8||height<8)throw Error('Choose a fabric image at least 8 × 8 pixels.');
    if(width*height>25_000_000)throw Error('This image is too large to edit safely. Use a photo below 25 megapixels.');
    const factor=Math.min(1,2048/Math.max(width,height));
    const source=canvas2d(Math.max(1,Math.round(width*factor)),Math.max(1,Math.round(height*factor)));
    source.context.drawImage(image,0,0,source.canvas.width,source.canvas.height);
    return {blob:file,image:source.canvas,url,name:file.name,originalWidth:width,originalHeight:height,dispose:()=>URL.revokeObjectURL(url)};
  }catch(error){URL.revokeObjectURL(url);throw error;}
}
export function cropFabric(source:HTMLCanvasElement,crop:CropRect){
  const safe=clampCrop(crop),x=Math.min(source.width-1,Math.floor(safe.x*source.width)),y=Math.min(source.height-1,Math.floor(safe.y*source.height));
  const width=Math.max(1,Math.min(source.width-x,Math.round(safe.width*source.width))),height=Math.max(1,Math.min(source.height-y,Math.round(safe.height*source.height)));
  const target=canvas2d(width,height);target.context.drawImage(source,x,y,width,height,0,0,width,height);return target.canvas;
}
