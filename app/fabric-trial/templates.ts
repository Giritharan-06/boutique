import type {Alignment,CropRect,GarmentTemplate,ModelAsset,TextureSettings} from './types';

export const referenceModel:ModelAsset={id:'illustrated-front-v1',url:'/fabric-trial/reference-model.svg',width:768,height:1024,label:'Illustrated reference model',placeholder:true,protectedTop:270,pivot:{x:384,y:420}};
export const fullCrop:CropRect={x:0,y:0,width:1,height:1};
export const defaultTexture:TextureSettings={scale:1,rotation:0,x:0,y:0,repeat:true};
export const defaultAlignment:Alignment={x:0,y:0,scale:1,rotation:0};
const paths=[
  {id:'boat-neck',name:'Boat Neck Blouse',description:'A wide neckline with short, simple sleeves.',path:'M270 311 Q300 292 325 298 Q384 328 443 298 Q468 292 498 311 L532 373 L492 397 L472 361 L465 537 Q384 555 303 537 L296 361 L276 397 L236 373 Z',seams:['M303 522 Q384 538 465 522']},
  {id:'princess-cut',name:'Princess Cut Blouse',description:'A shaped neckline with optional princess seam guides.',path:'M270 311 L325 294 Q350 288 366 317 Q384 308 402 317 Q418 288 443 294 L498 311 L524 370 L487 391 L472 360 L465 537 Q384 555 303 537 L296 360 L281 391 L244 370 Z',seams:['M325 306 Q340 359 335 399 Q316 458 326 540','M443 306 Q428 359 433 399 Q452 458 442 540','M303 522 Q384 538 465 522']},
  {id:'puff-sleeve',name:'Puff Sleeve Blouse',description:'Rounded sleeve silhouettes with gathered edges.',path:'M275 311 Q295 292 325 299 Q384 341 443 299 Q473 292 493 311 C547 297 565 339 550 381 Q541 405 503 405 L474 367 L465 537 Q384 555 303 537 L294 367 L265 405 Q227 405 218 381 C203 339 221 297 275 311 Z',seams:['M232 386 Q247 394 267 389','M501 389 Q521 394 536 386','M280 316 Q297 335 294 367','M488 316 Q471 335 474 367']},
  {id:'elbow-sleeve',name:'Elbow-Length Sleeve Blouse',description:'A classic neckline with longer fitted sleeves.',path:'M270 311 Q299 291 327 298 Q384 347 441 298 Q469 291 498 311 Q518 336 529 384 L546 467 L501 479 L473 365 L465 537 Q384 555 303 537 L295 365 L267 479 L222 467 L239 384 Q250 336 270 311 Z',seams:['M226 453 L271 465','M497 465 L542 453','M303 522 Q384 538 465 522']},
] as const;
export const blouseTemplates:GarmentTemplate[]=paths.map(item=>({...item,seams:[...item.seams],maskUrl:`/fabric-trial/${item.id}-mask.svg`,thumbnailUrl:`/fabric-trial/${item.id}-thumb.svg`,bounds:{x:210,y:288,width:348,height:265}}));
export function templateById(id:string){return blouseTemplates.find(template=>template.id===id)||blouseTemplates[0];}

export function clampCrop(crop:CropRect):CropRect{
  const width=Math.max(.05,Math.min(1,Number.isFinite(crop.width)?crop.width:1));
  const height=Math.max(.05,Math.min(1,Number.isFinite(crop.height)?crop.height:1));
  return {x:Math.max(0,Math.min(1-width,Number.isFinite(crop.x)?crop.x:0)),y:Math.max(0,Math.min(1-height,Number.isFinite(crop.y)?crop.y:0)),width,height};
}
export function clampTexture(value:TextureSettings):TextureSettings{
  const clamp=(number:number,min:number,max:number,fallback:number)=>Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;
  return {scale:clamp(value.scale,.25,3,1),rotation:clamp(value.rotation,-180,180,0),x:clamp(value.x,-200,200,0),y:clamp(value.y,-200,200,0),repeat:Boolean(value.repeat)};
}
export function clampAlignment(value:Alignment):Alignment{
  const clamp=(number:number,min:number,max:number,fallback:number)=>Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;
  return {x:clamp(value.x,-60,60,0),y:clamp(value.y,-40,40,0),scale:clamp(value.scale,.85,1.15,1),rotation:clamp(value.rotation,-8,8,0)};
}
