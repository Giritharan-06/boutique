import { openDatabase, type Database } from './database';
import { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
const cookieName = (role: 'admin' | 'customer') => 'aarini_' + role + '_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export type Account = {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: 'admin' | 'customer';
};
const db = openDatabase;
const clean = (row: any): Account => ({ id: row.id, name: row.name, email: row.email, phone: row.phone, role: row.role });
function digest(token: string) { return createHash('sha256').update(token).digest('hex'); }
function sessionToken(req: Request, role: 'admin' | 'customer') { const value = req.headers.get('cookie') || ''; for (const pair of value.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key === cookieName(role))
        return decodeURIComponent(rest.join('='));
} return ''; }
export function sessionCookie(token: string, role: 'admin' | 'customer',secure=false) { return cookieName(role) + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (SESSION_MS / 1000)+(secure?'; Secure':''); }
export function clearSessionCookie(role: 'admin' | 'customer',secure=false) { return cookieName(role) + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+(secure?'; Secure':''); }
async function newSession(accountId: string,d:Database) { const token = randomBytes(32).toString('base64url');
    (await d.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()));
    (await d.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)').run(digest(token), accountId, Date.now() + SESSION_MS));
    return token;
}
export async function getAuthUser(req: Request, role: 'admin' | 'customer'): Promise<Account | null> { const token = sessionToken(req, role); if (!token)
    return null; const d = (await db()); try {
    const row = (await d.prepare('SELECT a.id,a.name,a.email,a.phone,a.role FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND a.role=?').get(digest(token), Date.now(), role));
    return row ? clean(row) : null;
}
finally {
    d.close();
} }
export async function createAccount(input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: 'admin' | 'customer';
}) { const name = input.name.trim(), email = input.email.trim().toLowerCase(), phone = (input.phone || '').trim(), password = input.password; if (name.length < 2 || name.length > 100)
    throw Error('Enter a name between 2 and 100 characters.'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw Error('Enter a valid email address.'); if (input.role === 'customer' && (phone.length < 7 || phone.length > 30))
    throw Error('Enter a phone number for order updates.'); if (password.length < 10 || password.length > 128)
    throw Error('Use a password between 10 and 128 characters.'); const salt = randomBytes(16).toString('hex'), passwordHash = scryptSync(password, salt, 64).toString('hex'), account: Account = { id: randomUUID(), name, email, phone, role: input.role }; const d = (await db()); try {
    (await d.prepare('INSERT INTO accounts(id,name,email,phone,role,salt,password_hash,created_at) VALUES(?,?,?,?,?,?,?,?)').run(account.id, name, email, phone, input.role, salt, passwordHash, Date.now()));
    return { account, token: (await newSession(account.id,d)) };
}
catch (e) {
    if (String(e).toLowerCase().includes('unique'))
        throw Error('An account already uses this email. Sign in instead.');
    throw e;
}
finally {
    d.close();
} }
export async function signIn(emailInput: string, password: string, role: 'admin' | 'customer') { const email = emailInput.trim().toLowerCase(); if (password.length > 128)
    throw Error('Check your email and password.'); const d = (await db()); try {
    const row = (await d.prepare('SELECT id,name,email,phone,role,salt,password_hash FROM accounts WHERE email=?').get(email)) as any;
    if (!row || row.role !== role)
        throw Error('Check your email and password.');
    const candidate = scryptSync(password, row.salt, 64), expected = Buffer.from(row.password_hash, 'hex');
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected))
        throw Error('Check your email and password.');
    return { account: clean(row), token: (await newSession(row.id,d)) };
}
finally {
    d.close();
} }
export async function destroySession(req: Request, role: 'admin' | 'customer') { const token = sessionToken(req, role); if (!token)
    return; const d = (await db()); try {
    (await d.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token)));
}
finally {
    d.close();
} }
