import { providerStatus, createJob, friendlyError } from '../../../lib/local/try-on';
import { readShop } from '../../../lib/local/store';
import { appRequest, boundedJson } from '../../../lib/local/security';
import { getAuthUser } from '../../../lib/local/auth';
import { reservePreview, settlePreview, readPreviewAccess, PreviewLimitError } from '../../../lib/local/commerce';
import { randomUUID } from 'node:crypto';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { if (!appRequest(req))
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 }); return Response.json({ connected: (await providerStatus()).connected }, { headers: { 'Cache-Control': 'no-store' } }); }
export async function POST(req: Request) { if (!appRequest(req, true))
    return Response.json({ error: 'Invalid request.' }, { status: 403 }); let user = (await getAuthUser(req, 'customer')) || (await getAuthUser(req, 'admin')); if (!user)
    return Response.json({ error: 'Please sign in to create a preview.' }, { status: 401 }); const id = randomUUID(); let reserved = false; try {
    const body = await boundedJson(req, 7100000);
    if (body.studio === true) {
        const admin = (await getAuthUser(req, 'admin'));
        if (!admin)
            throw Error('Please sign in to the studio.');
        user = admin;
    }
    if (body.consent !== true)
        throw Error('Allow your photo to be processed for this preview first.');
    if (typeof body.photo !== 'string' || !['S', 'M', 'L', 'XL'].includes(body.size))
        throw Error('Choose a photo and size.');
    const product = (await readShop()).shop.products.find(product => product.id === body.product && !product.archived);
    if (!product)
        throw Error('Outfit not found.');
    if (user.role === 'customer') {
        (await reservePreview(user.id, id));
        reserved = true;
    }
    return Response.json(await createJob(body.photo, product.imageSet, product.imageIndex, product.images?.[product.imageIndex] || product.images?.[0], { id, accountId: user.id, billable: reserved }), { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
catch (error) {
    if (reserved)
        (await settlePreview(id, false));
    const limited = error instanceof PreviewLimitError;
    return Response.json({ error: limited ? 'Limit reached' : friendlyError(error), code: limited ? 'LIMIT_REACHED' : undefined, access: user.role === 'customer' ? (await readPreviewAccess(user.id)) : undefined }, { status: limited ? 429 : 400 });
} }
