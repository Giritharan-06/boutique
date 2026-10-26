import { readShop } from '../../../lib/local/store';
import { appRequest } from '../../../lib/local/security';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { if (!appRequest(req))
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 }); try {
    return Response.json({ products: (await readShop()).shop.products.filter(product => !product.archived) }, { headers: { 'Cache-Control': 'no-store' } });
}
catch {
    return Response.json({ error: 'Unable to load the boutique collection.' }, { status: 503 });
} }
