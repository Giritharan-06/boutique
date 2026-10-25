import {readCommerceSettings} from '../../../lib/local/commerce';
import {localRequest} from '../../../lib/local/security';
export const dynamic='force-dynamic';
export async function GET(req:Request){if(!localRequest(req))return Response.json({error:'Local access only.'},{status:403});return Response.json({settings:readCommerceSettings().settings},{headers:{'Cache-Control':'no-store'}});}
