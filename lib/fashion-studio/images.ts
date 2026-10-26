import sharp from 'sharp';
import {StudioError,type StudioImage,type Analysis} from '../../app/fashion-studio/model';
import {saveAsset} from './store';
export class ImageUploadService{
  async prepare(bytes:Buffer,mime:string){
    if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new StudioError('INVALID_IMAGE','Choose a JPG, PNG or WebP image.');
    if(bytes.length===0||bytes.length>3*1024*1024)throw new StudioError('IMAGE_SIZE','Choose an image under 3 MB.');
    try{
      const image=sharp(bytes,{limitInputPixels:25_000_000,animated:false}),metadata=await image.metadata();
      if(!['jpeg','png','webp'].includes(metadata.format||'')||(metadata.pages||1)>1)throw Error();
      if((metadata.width||0)<64||(metadata.height||0)<64)throw Error();
      const output=await image.rotate().flatten({background:'#fff'}).resize({width:1400,height:1400,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
      return {bytes:output.data,width:output.info.width,height:output.info.height,palette:await palette(output.data)};
    }catch{throw new StudioError('INVALID_IMAGE','This image could not be read. Use a non-animated JPG, PNG or WebP between 64 pixels and 25 megapixels.');}
  }
  async upload(owner:string,bytes:Buffer,mime:string,kind:'reference'|'person'){const image=await this.prepare(bytes,mime);return saveAsset(owner,image.bytes,{width:image.width,height:image.height,palette:image.palette,kind});}
}
export async function palette(bytes:Buffer){
  const {data}=await sharp(bytes).resize(64,64,{fit:'inside'}).removeAlpha().raw().toBuffer({resolveWithObject:true});const bins=new Map<string,number>();
  for(let i=0;i<data.length;i+=3){const rgb=[data[i],data[i+1],data[i+2]].map(v=>Math.min(255,Math.round(v/32)*32));const key='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');bins.set(key,(bins.get(key)||0)+1);}
  return [...bins].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([colour])=>colour);
}
export class ImageAnalysisService{
  inspect(asset:StudioImage):Analysis{return {method:'image-inspection',summary:`Image validated · ${asset.width} × ${asset.height}. Sampled palette only; garment features have not been identified by AI.`,palette:asset.palette,features:{neckline:'Unverified',sleeves:'Unverified',pattern:'Unverified',embroidery:'Unverified',border:'Unverified',pallu:'Unverified'},uncertainties:['Colour samples include the background.','Hidden embroidery, fabric type and garment geometry cannot be inferred by this inspection.']};}
}
export class FabricAnalysisService extends ImageAnalysisService{}
export class SareeAnalysisService extends ImageAnalysisService{}
export class ResultExportService{
  async png(bytes:Buffer){try{return await sharp(bytes,{limitInputPixels:25_000_000}).rotate().png().toBuffer();}catch{throw new StudioError('INVALID_OUTPUT','The provider returned an unreadable image.',502);}}
}
