import { openDatabase, type Database } from './database';
import { randomUUID } from 'node:crypto';
import { defaultCommerceSettings, validateCommerceSettings, type CommerceSettings, type PreviewAccess, type AiPurchase } from '../../app/commerce-model';
let settingsReady=false;
async function db() { const d = await openDatabase(); try {
    if(!settingsReady){await d.prepare('INSERT OR IGNORE INTO commerce_settings(id,data,revision) VALUES(1,?,0)').run(JSON.stringify(defaultCommerceSettings));settingsReady=true;}
    return d;
}
catch (error) {
    d.close();
    throw error;
} }
async function settingsFrom(d: Database) { const row = (await d.prepare('SELECT data,revision FROM commerce_settings WHERE id=1').get()) as {
    data: string;
    revision: number;
}; return { settings: { ...defaultCommerceSettings, ...JSON.parse(row.data) } as CommerceSettings, revision: row.revision }; }
export async function readCommerceSettings() { const d = (await db()); try {
    return (await settingsFrom(d));
}
finally {
    d.close();
} }
export async function saveCommerceSettings(revision: number, value: unknown) { const settings = validateCommerceSettings(value), d = (await db()); try {
    const result = (await d.prepare('UPDATE commerce_settings SET data=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(settings), revision));
    if (!result.changes)
        throw Error('Settings changed in another window. Refresh and try again.');
    return (await settingsFrom(d));
}
finally {
    d.close();
} }
async function ensureAccess(d: Database, id: string) { (await d.prepare('INSERT OR IGNORE INTO customer_access(account_id) VALUES(?)').run(id)); }
type UsageRow = {
    id: string;
    account_id: string;
    source: string;
    amount: number;
    status: string;
};
async function refundIn(d: Database, usage: UsageRow) { if (usage.status !== 'reserved')
    return; const result = (await d.prepare("UPDATE preview_usage SET status='refunded' WHERE id=? AND status='reserved'").run(usage.id)); if (!result.changes)
    return; if (usage.source === 'wallet')
    (await d.prepare('UPDATE customer_access SET wallet=wallet+? WHERE account_id=?').run(usage.amount, usage.account_id)); if (usage.source === 'subscription')
    (await d.prepare('UPDATE customer_access SET plan_credits=plan_credits+? WHERE account_id=?').run(usage.amount, usage.account_id)); }
async function releaseExpired(d: Database, id: string) { const rows = (await d.prepare("SELECT * FROM preview_usage WHERE account_id=? AND status='reserved' AND created_at<?").all(id, Date.now() - 6 * 60 * 1000)) as UsageRow[]; for (const row of rows)
    (await refundIn(d, row)); }
async function accessFrom(d: Database, id: string): Promise<PreviewAccess> { (await ensureAccess(d, id)); const settings = (await settingsFrom(d)).settings; const row = (await d.prepare('SELECT * FROM customer_access WHERE account_id=?').get(id)) as {
    free_limit: number | null;
    enabled: number;
    wallet: number;
    plan_credits: number;
    plan_until: number;
    plan_name: string;
    ending: number;
}; const period = new Date().toISOString().slice(0, 7); const used = (await d.prepare("SELECT COUNT(*) AS used FROM preview_usage WHERE account_id=? AND period=? AND source='free' AND status IN ('reserved','consumed')").get(id, period)) as {
    used: number;
}; const freeLimit = row.free_limit ?? settings.defaultAiLimit, freeRemaining = Math.max(0, freeLimit - used.used), subscriptionCredits = row.plan_until > Date.now() ? row.plan_credits : 0; return { freeLimit, freeUsed: used.used, freeRemaining, walletCredits: row.wallet, subscriptionCredits, subscriptionUntil: row.plan_until, subscriptionName: row.plan_name, ending: Boolean(row.ending), previewCost: settings.previewCost, available: freeRemaining + Math.floor(row.wallet / settings.previewCost) + Math.floor(subscriptionCredits / settings.previewCost), enabled: settings.aiEnabled && Boolean(row.enabled) }; }
export async function readPreviewAccess(id: string) { const d = (await db()); try {
    (await d.exec('BEGIN IMMEDIATE'));
    (await releaseExpired(d, id));
    const access = (await accessFrom(d, id));
    (await d.exec('COMMIT'));
    return access;
}
catch (error) {
    try {
        (await d.exec('ROLLBACK'));
    }
    catch { }
    throw error;
}
finally {
    d.close();
} }
export class PreviewLimitError extends Error {
    constructor() { super('Limit reached'); }
}
export async function reservePreview(id: string, usageId: string) { const d = (await db()); try {
    (await d.exec('BEGIN IMMEDIATE'));
    (await releaseExpired(d, id));
    const existing = (await d.prepare('SELECT id FROM preview_usage WHERE id=?').get(usageId));
    if (existing)
        throw Error('This preview has already been submitted.');
    const access = (await accessFrom(d, id));
    if (!access.enabled || access.available < 1)
        throw new PreviewLimitError();
    let source = 'free', amount = 0;
    if (access.freeRemaining < 1) {
        amount = access.previewCost;
        if (access.subscriptionCredits >= amount) {
            source = 'subscription';
            (await d.prepare('UPDATE customer_access SET plan_credits=plan_credits-? WHERE account_id=?').run(amount, id));
        }
        else {
            source = 'wallet';
            (await d.prepare('UPDATE customer_access SET wallet=wallet-? WHERE account_id=?').run(amount, id));
        }
    }
    (await d.prepare("INSERT INTO preview_usage(id,account_id,period,source,amount,status,created_at) VALUES(?,?,?,?,?,'reserved',?)").run(usageId, id, new Date().toISOString().slice(0, 7), source, amount, Date.now()));
    (await d.exec('COMMIT'));
    return (await accessFrom(d,id));
}
catch (error) {
    try {
        (await d.exec('ROLLBACK'));
    }
    catch { }
    throw error;
}
finally {
    d.close();
} }
export async function settlePreview(usageId: string, success: boolean) { const d = (await db()); try {
    (await d.exec('BEGIN IMMEDIATE'));
    const row = (await d.prepare('SELECT * FROM preview_usage WHERE id=?').get(usageId)) as UsageRow | undefined;
    if (row) {
        if (success)
            (await d.prepare("UPDATE preview_usage SET status='consumed' WHERE id=? AND status='reserved'").run(usageId));
        else
            (await refundIn(d, row));
    }
    (await d.exec('COMMIT'));
}
catch (error) {
    try {
        (await d.exec('ROLLBACK'));
    }
    catch { }
    throw error;
}
finally {
    d.close();
} }
export async function updateUserAccess(input: {
    accountId: string;
    freeLimit: number | null;
    grantCredits: number;
    enabled: boolean;
}) { if (typeof input.accountId !== 'string' || (input.freeLimit !== null && (!Number.isSafeInteger(input.freeLimit) || input.freeLimit < 0 || input.freeLimit > 10000)) || !Number.isSafeInteger(input.grantCredits) || input.grantCredits < 0 || input.grantCredits > 100000 || typeof input.enabled !== 'boolean')
    throw Error('Check the preview limit and credit amount.'); const d = (await db()); try {
    (await d.exec('BEGIN IMMEDIATE'));
    if (!(await d.prepare("SELECT id FROM accounts WHERE id=? AND role='customer'").get(input.accountId)))
        throw Error('Customer account not found.');
    (await ensureAccess(d, input.accountId));
    (await d.prepare('UPDATE customer_access SET free_limit=?,wallet=wallet+?,enabled=? WHERE account_id=?').run(input.freeLimit, input.grantCredits, input.enabled ? 1 : 0, input.accountId));
    (await d.exec('COMMIT'));
    return (await accessFrom(d,input.accountId));
}
catch (error) {
    try {
        (await d.exec('ROLLBACK'));
    }
    catch { }
    throw error;
}
finally {
    d.close();
} }
const purchaseFields = 'p.id,p.account_id AS accountId,a.name AS customer,a.email,p.kind,p.name,p.credits,p.price,p.days,p.status,p.created_at AS createdAt,p.confirmed_at AS confirmedAt';
export async function listAiPurchases(accountId?: string) { const d = (await db()); try {
    return (await d.prepare('SELECT ' + purchaseFields + ' FROM ai_purchases p JOIN accounts a ON a.id=p.account_id ' + (accountId ? 'WHERE p.account_id=? ' : '') + 'ORDER BY p.created_at DESC').all(...accountId ? [accountId] : [])) as AiPurchase[];
}
finally {
    d.close();
} }
export async function createAiPurchase(accountId: string, kind: unknown, offerId: unknown, expectedPrice?: unknown) { if (kind !== 'credits' && kind !== 'subscription' || typeof offerId !== 'string')
    throw Error('Choose a credit pack or plan.'); const d = (await db()); try {
    (await d.exec('BEGIN IMMEDIATE'));
    const settings = (await settingsFrom(d)).settings;
    if (kind === 'credits' && !settings.creditSalesEnabled || kind === 'subscription' && !settings.subscriptionSalesEnabled)
        throw Error('This option is not available right now.');
    const access = (await accessFrom(d, accountId));
    if (!access.enabled)
        throw new PreviewLimitError();
    const offer = (kind === 'credits' ? settings.creditPacks : settings.subscriptionPlans).find(item => item.id === offerId && item.enabled);
    if (!offer)
        throw Error('This option is not available right now.');
    if (expectedPrice !== undefined && expectedPrice !== offer.price)
        throw Error('This price changed. Refresh and review the offer.');
    const existing = (await d.prepare("SELECT id FROM ai_purchases WHERE account_id=? AND kind=? AND name=? AND status='Pending'").get(accountId, kind, offer.name)) as {
        id: string;
    } | undefined;
    if (existing) {
        (await d.exec('COMMIT'));
        return (await d.prepare('SELECT '+purchaseFields+' FROM ai_purchases p JOIN accounts a ON a.id=p.account_id WHERE p.id=?').get(existing.id)) as AiPurchase;
    }
    const id = 'AI-' + randomUUID().slice(0, 8).toUpperCase();
    (await d.prepare("INSERT INTO ai_purchases(id,account_id,kind,name,credits,price,days,status,created_at) VALUES(?,?,?,?,?,?,?,'Pending',?)").run(id, accountId, kind, offer.name, offer.credits, offer.price, Number('days' in offer ? offer.days : 0), Date.now()));
    (await d.exec('COMMIT'));
    return (await d.prepare('SELECT '+purchaseFields+' FROM ai_purchases p JOIN accounts a ON a.id=p.account_id WHERE p.id=?').get(id)) as AiPurchase;
}
catch (error) {
    try {
        (await d.exec('ROLLBACK'));
    }
    catch { }
    throw error;
}
finally {
    d.close();
} }
export async function manageAiPurchase(id: string, action: 'confirm' | 'cancel', ownerId?: string) { const d = (await db()); try {
    (await d.exec('BEGIN IMMEDIATE'));
    const row = (await d.prepare('SELECT * FROM ai_purchases WHERE id=?').get(id)) as {
        account_id: string;
        status: string;
        kind: string;
        credits: number;
        days: number;
        name: string;
    } | undefined;
    if (!row || ownerId && row.account_id !== ownerId)
        throw Error('Purchase not found.');
    if (action !== 'confirm' && action !== 'cancel')
        throw Error('Choose a valid purchase action.');
    if (row.status !== 'Pending') {
        if (action === 'confirm' && row.status === 'Active') {
            (await d.exec('COMMIT'));
            return;
        }
        throw Error('This purchase is already ' + row.status.toLowerCase() + '.');
    }
    if (ownerId && action === 'confirm')
        throw Error('Payment must be confirmed by the boutique.');
    if (action === 'cancel') {
        (await d.prepare("UPDATE ai_purchases SET status='Cancelled' WHERE id=?").run(id));
    }
    else {
        (await ensureAccess(d, row.account_id));
        if (row.kind === 'credits')
            (await d.prepare('UPDATE customer_access SET wallet=wallet+? WHERE account_id=?').run(row.credits, row.account_id));
        else {
            const current = (await d.prepare('SELECT plan_until,plan_credits FROM customer_access WHERE account_id=?').get(row.account_id)) as {
                plan_until: number;
                plan_credits: number;
            };
            const active = current.plan_until > Date.now();
            (await d.prepare('UPDATE customer_access SET plan_credits=?,plan_until=?,plan_name=?,ending=0 WHERE account_id=?').run((active ? current.plan_credits : 0) + row.credits, Math.max(Date.now(), current.plan_until) + row.days * 86400000, row.name, row.account_id));
        }
        (await d.prepare("UPDATE ai_purchases SET status='Active',confirmed_at=? WHERE id=? AND status='Pending'").run(Date.now(), id));
    }
    (await d.exec('COMMIT'));
}
catch (error) {
    try {
        (await d.exec('ROLLBACK'));
    }
    catch { }
    throw error;
}
finally {
    d.close();
} }
export async function endSubscription(id: string) { const d = (await db()); try {
    (await ensureAccess(d, id));
    (await d.prepare('UPDATE customer_access SET ending=1 WHERE account_id=?').run(id));
}
finally {
    d.close();
} return (await readPreviewAccess(id)); }
export async function readCustomerAddress(id: string) { const d = (await db()); try {
    return ((await d.prepare('SELECT address FROM customer_profiles WHERE account_id=?').get(id)) as {
        address: string;
    } | undefined)?.address || '';
}
finally {
    d.close();
} }
export async function saveCustomerAddress(id: string, address: string) { if (typeof address !== 'string' || address.length > 1000)
    throw Error('Use an address of up to 1,000 characters.'); const d = (await db()); try {
    (await d.prepare('INSERT INTO customer_profiles(account_id,address) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET address=excluded.address').run(id, address.trim()));
}
finally {
    d.close();
} }
export async function updateCustomerProfile(id: string, input: {
    name: string;
    phone: string;
    address: string;
}) { if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.length > 100 || typeof input.phone !== 'string' || input.phone.trim().length < 7 || input.phone.length > 30 || typeof input.address !== 'string' || input.address.length > 1000)
    throw Error('Check your name, phone number and delivery address.'); const d = (await db()); try {
    (await d.exec('BEGIN IMMEDIATE'));
    const user = (await d.prepare("SELECT id,email FROM accounts WHERE id=? AND role='customer'").get(id)) as {
        id: string;
        email: string;
    } | undefined;
    if (!user)
        throw Error('Customer account not found.');
    const name = input.name.trim(), phone = input.phone.trim();
    (await d.prepare('UPDATE accounts SET name=?,phone=? WHERE id=?').run(name, phone, id));
    (await d.prepare('INSERT INTO customer_profiles(account_id,address) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET address=excluded.address').run(id, input.address.trim()));
    const row = (await d.prepare('SELECT data FROM shop WHERE id=1').get()) as {
        data: string;
    } | undefined;
    if (row) {
        const shop = JSON.parse(row.data);
        const customer = shop.customers.find((item: {
            id: string;
            email: string;
        }) => item.id === id || item.email.toLowerCase() === user.email.toLowerCase());
        if (customer) {
            customer.name = name;
            customer.phone = phone;
            (await d.prepare('UPDATE shop SET data=?,revision=revision+1 WHERE id=1').run(JSON.stringify(shop)));
        }
    }
    (await d.exec('COMMIT'));
    return { id, name, email: user.email, phone, role: 'customer' as const };
}
catch (error) {
    try {
        (await d.exec('ROLLBACK'));
    }
    catch { }
    throw error;
}
finally {
    d.close();
} }
export async function listUserAccess() { const d = (await db()); try {
    const rows = (await d.prepare("SELECT id,name,email,phone FROM accounts WHERE role='customer' ORDER BY created_at DESC").all()) as {
        id: string;
        name: string;
        email: string;
        phone: string;
    }[];
    const result=[];
    for(const user of rows){
        await d.exec('BEGIN IMMEDIATE');
        await releaseExpired(d,user.id);
        const access=await accessFrom(d,user.id);
        await d.exec('COMMIT');
        const allowance=await d.prepare('SELECT free_limit,enabled FROM customer_access WHERE account_id=?').get(user.id);
        result.push({...user,access,customLimit:allowance?.free_limit??null,previewEnabled:allowance?.enabled!==0});
    }
    return result;
}
catch(error){await d.exec('ROLLBACK').catch(()=>{});throw error;}
finally {
    d.close();
} }
