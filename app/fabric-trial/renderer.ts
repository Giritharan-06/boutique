import {canvas2d,cropFabric,loadImage} from './images';
import {clampAlignment,clampTexture} from './templates';
import type {ComparisonMode,FabricRenderService,RenderedPreview,RenderRequest} from './types';

/** Flat, colour-preserving canvas compositing. No inference, recolouring or body warping. */
export class BrowserFabricRenderer implements FabricRenderService{
  readonly method='browser-overlay' as const;
  async render(request:RenderRequest,signal?:AbortSignal):Promise<RenderedPreview>{
    const [model,mask]=await Promise.all([loadImage(request.model.url,signal),loadImage(request.template.maskUrl,signal)]);
    if(signal?.aborted)throw new DOMException('Preview cancelled.','AbortError');
    const {width,height,pivot}=request.model,texture=clampTexture(request.texture),alignment=clampAlignment(request.alignment);
    const crop=cropFabric(request.fabric.image,request.crop),layer=canvas2d(width,height),ctx=layer.context;
    ctx.save();
    ctx.translate(pivot.x+alignment.x,pivot.y+alignment.y);ctx.rotate(alignment.rotation*Math.PI/180);ctx.scale(alignment.scale,alignment.scale);ctx.translate(-pivot.x,-pivot.y);
    ctx.drawImage(mask,0,0,width,height);
    ctx.globalCompositeOperation='source-in';
    const pattern=ctx.createPattern(crop,texture.repeat?'repeat':'no-repeat');
    if(!pattern)throw Error('The fabric pattern could not be prepared. Try another image.');
    const baseScale=texture.repeat?128/crop.width:Math.max(request.template.bounds.width/crop.width,request.template.bounds.height/crop.height);
    pattern.setTransform(new DOMMatrix().translate(pivot.x+texture.x,pivot.y+texture.y).rotate(texture.rotation).scale(baseScale*texture.scale).translate(-crop.width/2,-crop.height/2));
    ctx.fillStyle=pattern;ctx.fillRect(-width*4,-height*4,width*9,height*9);
    ctx.globalCompositeOperation='source-over';
    if(request.seamGuides){
      ctx.save();ctx.clip(new Path2D(request.template.path));ctx.strokeStyle='rgba(46,28,34,.3)';ctx.lineWidth=2;
      for(const seam of request.template.seams)ctx.stroke(new Path2D(seam));ctx.restore();
    }
    ctx.restore();
    // Rasterize the reference once so SVG/text antialiasing is identical in every comparison.
    const original=canvas2d(width,height);original.context.drawImage(model,0,0,width,height);
    const output=canvas2d(width,height);output.context.drawImage(original.canvas,0,0);
    output.context.save();output.context.beginPath();output.context.rect(0,request.model.protectedTop,width,height-request.model.protectedTop);output.context.clip();output.context.drawImage(layer.canvas,0,0);output.context.restore();
    return {surface:output.canvas,model:original.canvas,width,height,method:this.method,notice:'Fabric overlay prototype on an illustrated reference. Not an AI-generated fit.'};
  }
}
export function drawComparison(canvas:HTMLCanvasElement,result:RenderedPreview,mode:ComparisonMode,split:number){
  canvas.width=result.width;canvas.height=result.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Your browser cannot display this preview.');
  if(mode==='after'){ctx.drawImage(result.surface,0,0);return;}
  ctx.drawImage(result.model,0,0,result.width,result.height);
  if(mode==='before')return;
  const divider=result.width*Math.max(0,Math.min(100,split))/100;
  ctx.save();ctx.beginPath();ctx.rect(divider,0,result.width-divider,result.height);ctx.clip();ctx.drawImage(result.surface,0,0);ctx.restore();
  ctx.beginPath();ctx.moveTo(divider,0);ctx.lineTo(divider,result.height);ctx.strokeStyle='#fffaf4';ctx.lineWidth=3;ctx.stroke();
}
