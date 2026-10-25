import { getAuthUser } from '../../../lib/local/auth';
import { readShop, updateShop } from '../../../lib/local/store';
import { boundedJson, localRequest } from '../../../lib/local/security';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
    if (!localRequest(req, true))
        return Response.json({ error: 'Invalid local request.' }, { status: 403 });
    const user = (await getAuthUser(req, 'customer')) || (await getAuthUser(req, 'admin'));
    if (!user)
        return Response.json({ error: 'Sign in before requesting a fitting.' }, { status: 401 });
    try {
        const body = await boundedJson(req, 10000);
        const current = (await readShop());
        const result = (await updateShop(current.revision, { type: 'appointment', name: user.role === 'customer' ? user.name : body.name, date: body.date, service: body.service, notes: [typeof body.notes === 'string' ? body.notes : '', user.email, user.phone].filter(Boolean).join('\n').slice(0, 2000) }));
        if (!result)
            return Response.json({ error: 'The calendar changed. Please try again.' }, { status: 409 });
        return Response.json({ ok: true, appointment: result.shop.appointments[0] }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'Unable to save your fitting request.' }, { status: 400 });
    }
}
