import { createAccount, destroySession, getAuthUser, signIn, sessionCookie, clearSessionCookie } from '../../../lib/local/auth';
import { registerCustomer } from '../../../lib/local/store';
import { appRequest, boundedJson, hostedDeployment } from '../../../lib/local/security';
export const dynamic = 'force-dynamic';
const json = (v: unknown, status = 200, headers: HeadersInit = {}) => Response.json(v, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
export async function GET(req: Request) { if (!appRequest(req))
    return json({ error: 'Request origin is not allowed.' }, 403); const role = new URL(req.url).searchParams.get('role'); if (role === 'admin' || role === 'customer')
    return json({ user: (await getAuthUser(req, role)) }); return json({ user: (await getAuthUser(req, 'customer')) || (await getAuthUser(req, 'admin')) }); }
export async function POST(req: Request) { if (!appRequest(req, true))
    return json({ error: 'Invalid request origin.' }, 403); try {
    const body = await boundedJson(req, 20000);
    if (body.action === 'signout') {
        if (body.role !== 'admin' && body.role !== 'customer')
            throw Error('Choose which account to sign out.');
        (await destroySession(req, body.role));
        return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(body.role,hostedDeployment()||new URL(req.url).protocol==='https:') });
    }
    if (body.role !== 'admin' && body.role !== 'customer')
        throw Error('Choose an account type.');
    let result;
    if (body.action === 'signup') {
        if(body.role==='admin'&&hostedDeployment()&&!await getAuthUser(req,'admin'))return json({error:'A signed-in boutique owner must create studio accounts.'},403);
        if (typeof body.name !== 'string' || typeof body.email !== 'string' || typeof body.password !== 'string')
            throw Error('Complete the account details.');
        result = (await createAccount({ name: body.name, email: body.email, phone: typeof body.phone === 'string' ? body.phone : '', password: body.password, role: body.role }));
        if (body.role === 'customer')
            (await registerCustomer(result.account));
    }
    else if (body.action === 'signin') {
        if (typeof body.email !== 'string' || typeof body.password !== 'string')
            throw Error('Enter your email and password.');
        result = (await signIn(body.email, body.password, body.role));
    }
    else
        throw Error('Choose sign in or create account.');
    return json({ user: result.account }, 200, { 'Set-Cookie': sessionCookie(result.token, result.account.role,hostedDeployment()||new URL(req.url).protocol==='https:') });
}
catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unable to complete sign in.' }, 400);
} }
