import {readProductImage} from '../../../../lib/local/product-images';
import {localRequest} from '../../../../lib/local/security';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){if(!localRequest(req))return new Response('Local access only.',{status:403});const {id}=await params;const image=await readProductImage(id);if(!image)return new Response('Image not found.',{status:404});return new Response(image,{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
