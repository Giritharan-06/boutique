export type StudioModule='reference'|'fabric'|'saree';
export type ReferenceKind='flat-lay'|'model'|'screenshot'|'fabric';
export type JobAction='concepts'|'try-on'|'analysis';
export type StudioStatus='submitting'|'queued'|'running'|'completed'|'failed'|'cancelled';
export type Design={id:string;name:string;neckline:string;sleeve:string;group:'Classic'|'Statement';cell:number};
export const blouseDesigns:Design[]=[
  {id:'boat',name:'Boat Neck',neckline:'Boat neckline',sleeve:'Short fitted sleeves',group:'Classic',cell:0},
  {id:'princess',name:'Princess Cut',neckline:'Square neckline · princess seams',sleeve:'Short fitted sleeves',group:'Classic',cell:1},
  {id:'puff',name:'Puff Sleeve',neckline:'Soft round neckline',sleeve:'Gathered puff sleeves',group:'Statement',cell:2},
  {id:'elbow',name:'Elbow-Length Sleeve',neckline:'Round neckline',sleeve:'Elbow-length sleeves',group:'Classic',cell:3},
  {id:'sweetheart',name:'Sweetheart Neck',neckline:'Sweetheart neckline',sleeve:'Short sleeves',group:'Statement',cell:4},
  {id:'high',name:'High Neck',neckline:'High band neckline',sleeve:'Elbow-length sleeves',group:'Classic',cell:5},
  {id:'designer',name:'Designer Blouse',neckline:'Asymmetric neckline',sleeve:'Fitted short sleeves',group:'Statement',cell:6}
];
export const matchingDesigns:Design[]=[
  {...blouseDesigns[0],id:'same',name:'Same-colour blouse'},
  {...blouseDesigns[3],id:'contrast',name:'Contrast-colour blouse'},
  {...blouseDesigns[0],id:'embroidered',name:'Embroidered blouse',cell:7},
  {...blouseDesigns[6],id:'matching-designer',name:'Designer blouse'}
];
export type StudioImage={id:string;url:string;width:number;height:number;expiresAt:number;palette:string[];kind:'reference'|'person'|'result'};
export type Analysis={method:'image-inspection'|'remote-ai';summary:string;palette:string[];features:Record<string,string>;uncertainties:string[];supported?:boolean;segmentedImageId?:string};
export type StudioResult={designId:string;name:string;asset:StudioImage;label:'AI-generated concept'|'AI try-on preview'};
export type StudioJob={id:string;module:StudioModule;action:JobAction;status:StudioStatus;createdAt:number;updatedAt:number;elapsedMs:number;message:string;error?:string;errorCode?:string;results:StudioResult[];analysis?:Analysis;designs:string[];referenceId:string;personId?:string;sourceKind:ReferenceKind;provider:string;review?:{identity:number;colour:number;pattern:number;neckline:number;sleeves:number;alignment:number;drape:number;notes:string}};
export type StudioCapabilities={enabled:true;demos:boolean;storageReady:boolean;reference:boolean;concepts:boolean;saree:boolean;analysis:boolean;segmentation:boolean;dailyLimit:number;used:number;remaining:number;modules:Record<StudioModule,{state:'trial'|'blocked';message:string}>};
export class StudioError extends Error{constructor(public code:string,message:string,public status=400){super(message);}}
export function designFor(id:string,module:StudioModule){return (module==='saree'?matchingDesigns:blouseDesigns).find(d=>d.id===id);}
export function conceptPrompt(design:Design,module:StudioModule){
  return `Create one photorealistic Indian saree blouse design concept from the visible ${module==='saree'?'saree reference':'fabric swatch'} in this image. ${design.name}. ${design.neckline}. ${design.sleeve}. Show one complete blouse, front view, isolated on a warm neutral background, no person, no text, no collage. ${design.id==='contrast'?'Choose a complementary contrasting colour.':design.id==='embroidered'?'Use embroidery inspired by the visible motifs.':'Preserve the visible colour palette and pattern as closely as possible.'} Do not copy a person or screenshot interface. Retain visible borders where feasible. This is a new design concept, not an exact fabric reproduction.`;
}
