import { getAuthUser } from '../../../lib/local/auth';
import { readCommerceSettings, saveCommerceSettings, listUserAccess, listAiPurchases, updateUserAccess, manageAiPurchase } from '../../../lib/local/commerce';
import { boundedJson, appRequest } from '../../../lib/local/security';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(req: Request) { if (!appRequest(req))
    return json({ error: 'Request origin is not allowed.' }, 403); if (!(await getAuthUser(req, 'admin')))
    return json({ error: 'Admin sign-in is required.' }, 401); return json({ ...(await readCommerceSettings()), users: (await listUserAccess()), purchases: (await listAiPurchases()) }); }
export async function POST(req: Request) { if (!appRequest(req, true))
    return json({ error: 'Invalid request.' }, 403); if (!(await getAuthUser(req, 'admin')))
    return json({ error: 'Admin sign-in is required.' }, 401); try {
    const body = await boundedJson(req, 30000);
    if (body.action === 'settings') {
        if (!Number.isSafeInteger(body.revision))
            throw Error('Refresh your settings and try again.');
        (await saveCommerceSettings(body.revision, body.settings));
    }
    else if (body.action === 'userAccess')
        (await updateUserAccess({ accountId: body.accountId, freeLimit: body.freeLimit, grantCredits: body.grantCredits, enabled: body.enabled }));
    else if (body.action === 'purchase' && typeof body.id === 'string' && (body.decision === 'confirm' || body.decision === 'cancel'))
        (await manageAiPurchase(body.id, body.decision));
    else
        throw Error('Choose a valid settings action.');
    return json({ ...(await readCommerceSettings()), users: (await listUserAccess()), purchases: (await listAiPurchases()) });
}
catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to save settings.' }, 400);
} }
