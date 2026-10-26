import { readCommerceSettings } from '../../../lib/local/commerce';
import { appRequest } from '../../../lib/local/security';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { if (!appRequest(req))
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 }); return Response.json({ settings: (await readCommerceSettings()).settings }, { headers: { 'Cache-Control': 'no-store' } }); }
