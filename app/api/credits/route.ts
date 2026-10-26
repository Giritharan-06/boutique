import { getAuthUser } from '../../../lib/local/auth';
import { createAiPurchase, endSubscription, listAiPurchases, manageAiPurchase, readCommerceSettings, readPreviewAccess, PreviewLimitError } from '../../../lib/local/commerce';
import { boundedJson, appRequest } from '../../../lib/local/security';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(req: Request) { if (!appRequest(req))
    return json({ error: 'Request origin is not allowed.' }, 403); const user = (await getAuthUser(req, 'customer')); if (!user)
    return json({ error: 'Please sign in.' }, 401); return json({ access: (await readPreviewAccess(user.id)), settings: (await readCommerceSettings()).settings, purchases: (await listAiPurchases(user.id)) }); }
export async function POST(req: Request) { if (!appRequest(req, true))
    return json({ error: 'Invalid request.' }, 403); const user = (await getAuthUser(req, 'customer')); if (!user)
    return json({ error: 'Please sign in.' }, 401); try {
    const body = await boundedJson(req, 10000);
    let purchase;
    if (body.action === 'purchase')
        purchase = (await createAiPurchase(user.id, body.kind, body.offerId, body.expectedPrice));
    else if (body.action === 'cancelPurchase' && typeof body.id === 'string')
        (await manageAiPurchase(body.id, 'cancel', user.id));
    else if (body.action === 'endSubscription')
        (await endSubscription(user.id));
    else
        throw Error('Choose a valid action.');
    return json({ purchase, access: (await readPreviewAccess(user.id)), purchases: (await listAiPurchases(user.id)) });
}
catch (error) {
    return json({ error: error instanceof PreviewLimitError ? 'Limit reached' : error instanceof Error ? error.message : 'Unable to update your credits.', code: error instanceof PreviewLimitError ? 'LIMIT_REACHED' : undefined }, error instanceof PreviewLimitError ? 429 : 400);
} }
