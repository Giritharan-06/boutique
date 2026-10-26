import { getAuthUser } from '../../../lib/local/auth';
import { readCustomerAddress, readPreviewAccess, listAiPurchases, readCommerceSettings, updateCustomerProfile } from '../../../lib/local/commerce';
import { boundedJson, appRequest } from '../../../lib/local/security';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(req: Request) { if (!appRequest(req))
    return json({ error: 'Request origin is not allowed.' }, 403); const user = (await getAuthUser(req, 'customer')); if (!user)
    return json({ error: 'Please sign in.' }, 401); try {
    return json({ user, address: (await readCustomerAddress(user.id)), access: (await readPreviewAccess(user.id)), purchases: (await listAiPurchases(user.id)), settings: (await readCommerceSettings()).settings });
}
catch {
    return json({ error: 'Unable to open your account. Please try again.' }, 503);
} }
export async function POST(req: Request) { if (!appRequest(req, true))
    return json({ error: 'Invalid request.' }, 403); const user = (await getAuthUser(req, 'customer')); if (!user)
    return json({ error: 'Please sign in.' }, 401); try {
    const body = await boundedJson(req, 10000);
    const updated = (await updateCustomerProfile(user.id, { name: body.name, phone: body.phone, address: body.address }));
    return json({ user: updated, address: (await readCustomerAddress(user.id)) });
}
catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to save your profile.' }, 400);
} }
