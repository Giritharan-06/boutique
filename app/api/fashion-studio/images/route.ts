import {guard,studioJson,studioError} from '../../../../lib/fashion-studio/http';
import {ImageUploadService,ImageAnalysisService} from '../../../../lib/fashion-studio/images';
import {cleanupStudio} from '../../../../lib/fashion-studio/store';
import {StudioError} from '../../../fashion-studio/model';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(req:Request){try{
  const admin=await guard(req,true),reader=req.body?.getReader();if(!reader)throw new StudioError('INVALID_IMAGE','Choose an image.');
  const chunks:Uint8Array[]=[];let total=0;try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>3.2*1024*1024)throw new StudioError('IMAGE_SIZE','Choose an image under 3 MB.');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
  const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();const file=form.get('image'),kind=form.get('kind');if(!(file instanceof File)||!['reference','person'].includes(String(kind)))throw new StudioError('INVALID_IMAGE','Choose a reference or customer image.');
  await cleanupStudio();const asset=await new ImageUploadService().upload(admin.id,Buffer.from(await file.arrayBuffer()),file.type,kind as 'reference'|'person');return studioJson({asset,inspection:new ImageAnalysisService().inspect(asset)},201);
}catch(e){return studioError(e);}}
