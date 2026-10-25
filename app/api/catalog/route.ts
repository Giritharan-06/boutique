import {readShop} from '../../../lib/local/store';
import {localRequest} from '../../../lib/local/security';
export const dynamic='force-dynamic';
export async function GET(req:Request){if(!localRequest(req))return Response.json({error:'Local access only.'},{status:403});try{return Response.json({products:readShop().shop.products.filter(product=>!product.archived)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Unable to load the boutique collection.'},{status:503});}}
