import type {RenderedPreview} from './types';
export function previewPng(result:RenderedPreview):Promise<Blob>{
  return new Promise((resolve,reject)=>{
    try{result.surface.toBlob(blob=>blob?resolve(blob):reject(Error('PNG export failed. Please try again.')),'image/png');}
    catch{reject(Error('This preview cannot be exported. Reload the local model asset and try again.'));}
  });
}
export async function downloadPreview(result:RenderedPreview,designId:string){
  const blob=await previewPng(result),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`aarini-${designId}-fabric-preview.png`;document.body.appendChild(link);link.click();link.remove();
  // Keep the URL alive until the browser has taken ownership of the download.
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
