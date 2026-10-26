export type BlouseDesignId='boat-neck'|'princess-cut'|'puff-sleeve'|'elbow-sleeve';
export type CropRect={x:number;y:number;width:number;height:number};
export type TextureSettings={scale:number;rotation:number;x:number;y:number;repeat:boolean};
export type Alignment={x:number;y:number;scale:number;rotation:number};
export type ComparisonMode='after'|'before'|'split';
export type ModelAsset={id:string;url:string;width:number;height:number;label:string;placeholder:boolean;protectedTop:number;pivot:{x:number;y:number}};
export type GarmentTemplate={id:BlouseDesignId;name:string;description:string;maskUrl:string;thumbnailUrl:string;path:string;seams:string[];bounds:{x:number;y:number;width:number;height:number}};
export type FabricImage={blob:Blob;image:HTMLCanvasElement;url:string;name:string;originalWidth:number;originalHeight:number;dispose:()=>void};
export type RenderRequest={model:ModelAsset;template:GarmentTemplate;fabric:FabricImage;crop:CropRect;texture:TextureSettings;alignment:Alignment;seamGuides:boolean};
export type RenderedPreview={surface:HTMLCanvasElement;model:HTMLCanvasElement;width:number;height:number;method:'browser-overlay'|'ai';notice:string};

/** A future AI adapter can implement this contract after explicit consent.
 * Phase 1 supplies only BrowserFabricRenderer; it never sends the fabric online.
 * An AI adapter can use request.fabric.blob and return a decoded PNG surface.
 */
export interface FabricRenderService{readonly method:'browser-overlay'|'ai';render(request:RenderRequest,signal?:AbortSignal):Promise<RenderedPreview>}
