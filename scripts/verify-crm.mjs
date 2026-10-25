import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { databaseRuntime } from './database-runtime.mjs';
const load = await databaseRuntime();
const { openDatabase, databaseMode, closeDatabasePool } = await load('database');
import { join } from 'node:path';
const origin = 'http://127.0.0.1:5173';
const marker = '.local/crm-review-records.json';
const state = { backend: databaseMode(), accounts: [], orders: [], appointments: [], images: [], product: null };
function persist() { writeFileSync(marker, JSON.stringify(state)); }
async function cleanup() {
    if (!existsSync(marker))
        return;
    const records = JSON.parse(readFileSync(marker, 'utf8'));
    assert.equal(records.backend || 'sqlite', databaseMode(), 'Refusing to clean a different database.');
    const db = await openDatabase();
    try {
        (await db.exec('BEGIN IMMEDIATE'));
        const row = (await db.prepare('SELECT data FROM shop WHERE id=1').get());
        if (row) {
            const shop = JSON.parse(row.data);
            shop.products = shop.products.filter(product => product.id !== records.product);
            shop.customers = shop.customers.filter(customer => !records.accounts.some(account => account.id === customer.id));
            shop.orders = shop.orders.filter(order => !records.orders.includes(order.id));
            shop.appointments = shop.appointments.filter(appointment => !records.appointments.includes(appointment.id));
            (await db.prepare('UPDATE shop SET data=?,revision=revision+1 WHERE id=1').run(JSON.stringify(shop)));
        }
        for (const account of records.accounts) {
            for (const table of ['preview_usage', 'ai_purchases', 'customer_profiles', 'customer_access'])
                (await db.prepare('DELETE FROM ' + table + ' WHERE account_id=?').run(account.id));
            assert.match(account.email, /^crm-review-[a-z]+-\d+@example\.test$/);
            (await db.prepare('DELETE FROM sessions WHERE account_id=?').run(account.id));
            (await db.prepare('DELETE FROM accounts WHERE id=? AND email=?').run(account.id, account.email));
        }
        (await db.exec('COMMIT'));
    }
    catch (error) {
        try {
            (await db.exec('ROLLBACK'));
        }
        catch { }
        throw error;
    }
    finally {
        db.close();
    }
    for (const url of records.images) {
        const match = url.match(/^\/api\/product-images\/([a-f0-9-]{36})$/);
        if (match) {
            if (databaseMode() === 'postgres') {
                const images = await openDatabase();
                try {
                    await images.prepare('DELETE FROM product_images WHERE id=?').run(match[1]);
                }
                finally {
                    images.close();
                }
            }
            const file = join('.local', 'product-images', match[1] + '.jpg');
            if (existsSync(file))
                unlinkSync(file);
        }
    }
    unlinkSync(marker);
    console.log('PASS: Temporary review records and accounts removed.');
}
if (process.argv.includes('--cleanup')) {
    await cleanup();
    await closeDatabasePool();
    process.exit(0);
}
if (process.argv.includes('--inspect')) {
    const records = JSON.parse(readFileSync(marker, 'utf8'));
    const db = await openDatabase();
    const shop = JSON.parse((await db.prepare('SELECT data FROM shop WHERE id=1').get()).data);
    db.close();
    console.log(JSON.stringify({ product: shop.products.find(product => product.id === records.product), appointments: shop.appointments.filter(item => records.appointments.includes(item.id)) }));
    process.exit(0);
}
if (existsSync(marker))
    throw Error('A review is already active. Run this script with --cleanup first.');
async function api(path, { cookie, body, method = body ? 'POST' : 'GET' } = {}) { const response = await fetch(origin + path, { method, headers: { Origin: origin, ...cookie ? { Cookie: cookie } : {}, ...body ? { 'Content-Type': 'application/json' } : {} }, body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); assert.ok(response.ok, `${path}: ${JSON.stringify(data)}`); return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] }; }
let keep = false;
try {
    const stamp = Date.now();
    async function account(role) { const email = `crm-review-${role}-${stamp}@example.test`; const result = await api('/api/auth', { body: { action: 'signup', role, name: role === 'admin' ? 'CRM Review' : 'Review Customer', email, phone: '9999999999', password: 'CrmReview-only-2026!' } }); state.accounts.push({ id: result.data.user.id, email }); persist(); return { ...result, email }; }
    const admin = await account('admin'), customer = await account('customer');
    async function read() { return (await api('/api/studio', { cookie: admin.cookie })).data; }
    async function change(action) { const current = await read(); return (await api('/api/studio', { cookie: admin.cookie, body: { revision: current.revision, action } })).data; }
    assert.equal((await fetch(origin + '/api/studio')).status, 401);
    assert.equal((await fetch(origin + '/api/studio', { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    console.log('PASS: CRM requires admin sign-in and rejects cross-origin writes.');
    const name = `Review silk set ${stamp}`;
    const photo = 'data:image/jpeg;base64,' + readFileSync('public/collections/occasionwear-1.jpg').toString('base64');
    const added = await change({ type: 'product', product: { name, category: 'Contemporary', fabric: 'Review cotton', price: 1234, stock: 9, panel: 0, colour: '#b98688', photos: [photo] } });
    const product = added.shop.products.find(product => product.name === name);
    assert.ok(product);
    state.product = product.id;
    state.images = product.images;
    persist();
    assert.equal(product.images.length, 1);
    assert.ok((await fetch(origin + product.images[0])).ok);
    await change({ type: 'stock', id: product.id, stock: 7 });
    assert.equal((await read()).shop.products.find(item => item.id === product.id).stock, 7);
    await change({ type: 'productArchive', id: product.id, archived: true });
    assert.ok(!(await api('/api/catalog')).data.products.some(item => item.id === product.id));
    const archivedOrder = await fetch(origin + '/api/orders', { method: 'POST', headers: { Origin: origin, Cookie: customer.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ address: 'Synthetic review address', items: [{ product: product.id, quantity: 1, size: 'M' }] }) });
    assert.equal(archivedOrder.status, 400);
    await change({ type: 'productArchive', id: product.id, archived: false });
    assert.ok((await api('/api/catalog')).data.products.some(item => item.id === product.id));
    console.log('PASS: Image uploads, stock updates and archive/restore persist correctly.');
    const changed = await change({ type: 'customer', id: customer.data.user.id, name: 'Review Customer Updated', email: customer.email, phone: '9000000001', notes: 'Synthetic review: prefers cotton.' });
    assert.equal(changed.shop.customers.find(item => item.id === customer.data.user.id).notes, 'Synthetic review: prefers cotton.');
    const created = await api('/api/orders', { cookie: customer.cookie, body: { address: 'Synthetic review address', items: [{ product: product.id, quantity: 2, size: 'M', price: 1 }] } });
    state.orders.push(created.data.order.id);
    persist();
    assert.equal(created.data.order.total, 2468);
    await change({ type: 'status', id: created.data.order.id, status: 'Confirmed' });
    await change({ type: 'status', id: created.data.order.id, status: 'Cancelled' });
    await change({ type: 'status', id: created.data.order.id, status: 'Cancelled' });
    assert.equal((await read()).shop.products.find(item => item.id === product.id).stock, 7);
    const next = await api('/api/orders', { cookie: customer.cookie, body: { address: 'Synthetic review address', items: [{ product: product.id, quantity: 1, size: 'M' }] } });
    state.orders.push(next.data.order.id);
    persist();
    const current = await read();
    const conflict = await fetch(origin + '/api/studio', { method: 'POST', headers: { Origin: origin, Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: current.revision - 1, action: { type: 'stock', id: product.id, stock: 1 } }) });
    assert.equal(conflict.status, 409);
    console.log('PASS: Customer edits, trusted order totals, cancellation stock returns and update conflicts.');
    const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), later = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const fitting = await api('/api/appointments', { cookie: customer.cookie, body: { name: 'Untrusted name', date, service: 'Personal styling consultation', notes: 'Synthetic review fitting.' } });
    state.appointments.push(fitting.data.appointment.id);
    persist();
    assert.equal(fitting.data.appointment.name, customer.data.user.name);
    assert.ok(!('shop' in fitting.data));
    await change({ type: 'appointment', id: fitting.data.appointment.id, name: 'Review Customer Updated', date: later, service: 'Personal styling consultation', notes: 'Synthetic review: morning fitting.', status: 'Booked' });
    await change({ type: 'appointmentStatus', id: fitting.data.appointment.id, status: 'Cancelled' });
    await change({ type: 'appointmentStatus', id: fitting.data.appointment.id, status: 'Booked' });
    const final = await read();
    assert.equal(final.shop.appointments.filter(item => item.id === fitting.data.appointment.id).length, 1);
    assert.equal(final.shop.appointments.find(item => item.id === fitting.data.appointment.id).date, later);
    console.log('PASS: Customer fitting requests reach the CRM and can be rescheduled or cancelled.');
    keep = process.argv.includes('--keep');
    if (keep)
        console.log(JSON.stringify({ reviewAdmin: admin.email, product: name, customer: 'Review Customer Updated', order: next.data.order.id }));
}
finally {
    if (!keep)
        await cleanup();
    await closeDatabasePool();
}
