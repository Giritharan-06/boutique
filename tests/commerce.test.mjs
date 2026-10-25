import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, sep, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { defaultCommerceSettings, validateCommerceSettings, deliveryCharge, ownsOrder } from '../app/commerce-model.ts';
import { initialShop, reduceShop } from '../app/model.ts';
delete process.env.DATABASE_URL;
const project = process.cwd(), parent = join(project, '.local');
mkdirSync(parent, { recursive: true });
const temporary = mkdtempSync(join(parent, 'commerce-tests-'));
for (const [input, output] of [['app/commerce-model.ts', 'commerce-model.mjs'], ['lib/local/commerce.ts', 'commerce.mjs'], ['lib/local/auth.ts', 'auth.mjs'], ['lib/local/database.ts', 'database.mjs']]) {
    let source = readFileSync(join(project, input), 'utf8').replace("'../../app/commerce-model'", "'./commerce-model.mjs'").replace("'./database'", "'./database.mjs'");
    writeFileSync(join(temporary, output), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
}
process.chdir(temporary);
const commerce = await import(pathToFileURL(join(temporary, 'commerce.mjs')).href);
const auth = await import(pathToFileURL(join(temporary, 'auth.mjs')).href);
const database = await import(pathToFileURL(join(temporary, 'database.mjs')).href);
process.chdir(project);
const databasePath = join(temporary, '.local', 'boutique.sqlite');
let serial = 0;
const user = async () => (await auth.createAccount({ name: 'Test customer', email: `customer${++serial}@example.test`, phone: '1234567890', password: 'Only-for-tests-2026', role: 'customer' })).account;
const reserve = async (account) => { const id = randomUUID(); (await commerce.reservePreview(account.id, id)); return id; };
const zero = async (account, grantCredits = 0) => commerce.updateUserAccess({ accountId: account.id, freeLimit: 0, grantCredits, enabled: true });
after(() => { const checked = resolve(temporary); assert.ok(checked.startsWith(resolve(parent) + sep) && basename(checked).startsWith('commerce-tests-')); rmSync(checked, { recursive: true, force: true }); });

test('PostgreSQL pooler queries qualify tables without changing quoted text or parameters',()=>{
    const query=database.postgresSql("SELECT 'FROM accounts?' AS note,account_id AS accountId FROM preview_usage WHERE account_id=? AND status='reserved'");
    assert.ok(query.includes('FROM "aarini"."preview_usage"'));
    assert.ok(query.includes("'FROM accounts?'"));
    assert.ok(query.includes('account_id=$1'));
    assert.ok(query.includes('AS "accountId"'));
    assert.ok(database.postgresSql('INSERT OR IGNORE INTO customer_access(account_id) VALUES(?)').endsWith('ON CONFLICT DO NOTHING'));
});
test('offline database serializes asynchronous reservations without locking or overspending',async()=>{
    const account=await user();await zero(account,1);
    const attempts=await Promise.allSettled(Array.from({length:4},()=>reserve(account)));
    assert.equal(attempts.filter(attempt=>attempt.status==='fulfilled').length,1);
    assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits,0);
    const accepted=attempts.find(attempt=>attempt.status==='fulfilled').value;
    await commerce.settlePreview(accepted,false);
    assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits,1);
});
test('monthly limits include reservations and failed previews return allowance exactly once', async () => { const account = (await user()); assert.equal((await commerce.readPreviewAccess(account.id)).available, 3); const a = (await reserve(account)), b = (await reserve(account)), c = (await reserve(account)); assert.equal((await commerce.readPreviewAccess(account.id)).available, 0); (await assert.rejects(async () => reserve(account), /Limit reached/)); (await commerce.settlePreview(a, false)); (await commerce.settlePreview(a, false)); assert.equal((await commerce.readPreviewAccess(account.id)).available, 1); (await commerce.settlePreview(b, true)); (await commerce.settlePreview(c, true)); assert.equal((await commerce.readPreviewAccess(account.id)).freeUsed, 2); });
test('wallet credits are reserved, refunded once, and not refunded after successful delivery', async () => { const account = (await user()); (await zero(account, 5)); const failed = (await reserve(account)); assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits, 4); (await commerce.settlePreview(failed, false)); (await commerce.settlePreview(failed, false)); assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits, 5); const completed = (await reserve(account)); (await commerce.settlePreview(completed, true)); (await commerce.settlePreview(completed, false)); assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits, 4); });
test('preview IDs cannot be reused to create duplicate reservations', async () => { const account = (await user()), id = randomUUID(); (await commerce.reservePreview(account.id, id)); (await assert.rejects(async () => commerce.reservePreview(account.id, id), /already/)); assert.equal((await commerce.readPreviewAccess(account.id)).freeUsed, 1); });
test('stale reservations are released after a stopped process', async () => { const account = (await user()); (await zero(account, 3)); const id = (await reserve(account)); const db = new DatabaseSync(databasePath); db.prepare('UPDATE preview_usage SET created_at=? WHERE id=?').run(Date.now() - 7 * 60000, id); db.close(); assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits, 3); (await commerce.settlePreview(id, false)); assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits, 3); });
test('one customer cannot consume another customer’s allowance', async () => { const a = (await user()), b = (await user()); (await zero(a, 1)); (await reserve(a)); assert.equal((await commerce.readPreviewAccess(a.id)).available, 0); assert.equal((await commerce.readPreviewAccess(b.id)).available, 3); });
test('credit purchases stay pending and repeated confirmation grants credits once', async () => { const account = (await user()); (await zero(account)); const offer = (await commerce.readCommerceSettings()).settings.creditPacks[0]; (await assert.rejects(async () => commerce.createAiPurchase(account.id, 'credits', offer.id, offer.price + 1), /price changed/)); const purchase = (await commerce.createAiPurchase(account.id, 'credits', offer.id, offer.price)); assert.equal(purchase.status, 'Pending'); assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits, 0); assert.equal((await commerce.createAiPurchase(account.id, 'credits', offer.id)).id, purchase.id); (await commerce.manageAiPurchase(purchase.id, 'confirm')); (await commerce.manageAiPurchase(purchase.id, 'confirm')); assert.equal((await commerce.readPreviewAccess(account.id)).walletCredits, offer.credits); (await assert.rejects(async () => commerce.manageAiPurchase(purchase.id, 'cancel'), /already/)); });
test('customers cannot activate a purchase or cancel another customer’s purchase', async () => { const a = (await user()), b = (await user()), offer = (await commerce.readCommerceSettings()).settings.creditPacks[0]; const purchase = (await commerce.createAiPurchase(a.id, 'credits', offer.id)); (await assert.rejects(async () => commerce.manageAiPurchase(purchase.id, 'confirm', a.id), /boutique/)); (await assert.rejects(async () => commerce.manageAiPurchase(purchase.id, 'cancel', b.id), /not found/)); (await commerce.manageAiPurchase(purchase.id, 'cancel', a.id)); assert.equal((await commerce.readPreviewAccess(a.id)).walletCredits, 0); });
test('subscription activation, expiry choice and renewal preserve paid access correctly', async () => { const account = (await user()); (await zero(account)); const plan = (await commerce.readCommerceSettings()).settings.subscriptionPlans[0]; const purchase = (await commerce.createAiPurchase(account.id, 'subscription', plan.id)); assert.equal((await commerce.readPreviewAccess(account.id)).subscriptionCredits, 0); (await commerce.manageAiPurchase(purchase.id, 'confirm')); let access = (await commerce.readPreviewAccess(account.id)); assert.equal(access.subscriptionCredits, plan.credits); const expiry = access.subscriptionUntil; const used = (await reserve(account)); (await commerce.settlePreview(used, true)); access = (await commerce.endSubscription(account.id)); assert.equal(access.subscriptionUntil, expiry); assert.equal(access.ending, true); const renewal = (await commerce.createAiPurchase(account.id, 'subscription', plan.id)); (await commerce.manageAiPurchase(renewal.id, 'confirm')); access = (await commerce.readPreviewAccess(account.id)); assert.equal(access.subscriptionUntil, expiry + plan.days * 86400000); assert.equal(access.subscriptionCredits, plan.credits * 2 - 1); assert.equal(access.ending, false); });
test('expired subscription credits cannot create new previews', async () => { const account = (await user()); (await zero(account)); const plan = (await commerce.readCommerceSettings()).settings.subscriptionPlans[0], purchase = (await commerce.createAiPurchase(account.id, 'subscription', plan.id)); (await commerce.manageAiPurchase(purchase.id, 'confirm')); const db = new DatabaseSync(databasePath); db.prepare('UPDATE customer_access SET plan_until=? WHERE account_id=?').run(Date.now() - 1000, account.id); db.close(); assert.equal((await commerce.readPreviewAccess(account.id)).available, 0); (await assert.rejects(async () => reserve(account), /Limit reached/)); });
test('settings changes are versioned and preserve individual limit overrides', async () => { const a = (await user()), b = (await user()); (await commerce.updateUserAccess({ accountId: b.id, freeLimit: 6, grantCredits: 0, enabled: true })); const saved = (await commerce.readCommerceSettings()); try {
    (await commerce.saveCommerceSettings(saved.revision, { ...saved.settings, defaultAiLimit: 1 }));
    assert.equal((await commerce.readPreviewAccess(a.id)).freeLimit, 1);
    assert.equal((await commerce.readPreviewAccess(b.id)).freeLimit, 6);
    (await assert.rejects(async () => commerce.saveCommerceSettings(saved.revision, saved.settings), /another window/));
}
finally {
    const latest = (await commerce.readCommerceSettings());
    (await commerce.saveCommerceSettings(latest.revision, saved.settings));
} });
test('global preview pause does not overwrite the customer’s own enabled setting', async () => { const account = (await user()), saved = (await commerce.readCommerceSettings()); try {
    (await commerce.saveCommerceSettings(saved.revision, { ...saved.settings, aiEnabled: false }));
    assert.equal((await commerce.readPreviewAccess(account.id)).enabled, false);
    assert.equal((await commerce.listUserAccess()).find(row => row.id === account.id).previewEnabled, true);
    (await assert.rejects(async () => reserve(account), /Limit reached/));
}
finally {
    const latest = (await commerce.readCommerceSettings());
    (await commerce.saveCommerceSettings(latest.revision, saved.settings));
} });
test('profile updates affect only the signed-in customer record and preserve notes', async () => { const account = (await user()), other = (await user()); (await commerce.readCommerceSettings()); const shop = structuredClone(initialShop); shop.customers = [{ id: account.id, name: account.name, email: account.email, phone: account.phone, notes: 'Keep this note' }]; const db = new DatabaseSync(databasePath); db.exec('CREATE TABLE IF NOT EXISTS shop(id INTEGER PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)'); db.prepare('INSERT OR REPLACE INTO shop(id,data,revision) VALUES(1,?,0)').run(JSON.stringify(shop)); db.close(); const updated = (await commerce.updateCustomerProfile(account.id, { name: 'Updated name', phone: '1234567899', address: 'Test delivery address' })); assert.equal(updated.email, account.email); assert.equal((await commerce.readCustomerAddress(account.id)), 'Test delivery address'); assert.equal((await commerce.readCustomerAddress(other.id)), ''); const check = new DatabaseSync(databasePath); const persisted = JSON.parse(check.prepare('SELECT data FROM shop WHERE id=1').get().data); assert.equal(persisted.customers[0].name, 'Updated name'); assert.equal(persisted.customers[0].notes, 'Keep this note'); assert.equal(check.prepare('SELECT name FROM accounts WHERE id=?').get(other.id).name, other.name); check.close(); });
test('checkout IDs prevent duplicate orders and repeat stock reservations', async () => { const action = { type: 'order', accountId: 'account-a', checkoutId: randomUUID(), name: 'Buyer', email: 'buyer@example.test', phone: '1234567890', address: 'Test address', shipping: 50, items: [{ product: 'sage', size: 'M', quantity: 1 }] }; const once = reduceShop(initialShop, action), twice = reduceShop(once, action); assert.equal(twice.orders.length, 1); assert.equal(twice.orders[0].total, initialShop.products.find(product => product.id === 'sage').price + 50); assert.equal(twice.products.find(product => product.id === 'sage').stock, initialShop.products.find(product => product.id === 'sage').stock - 1); assert.equal(twice.orders[0].paymentStatus, 'Unpaid'); });
test('order ownership cannot be claimed by changing the email on an account-bound order', async () => { const order = { accountId: 'account-a', email: 'someone@example.test' }; assert.equal(ownsOrder(order, { id: 'account-b', email: 'someone@example.test' }), false); assert.equal(ownsOrder(order, { id: 'account-a', email: 'different@example.test' }), true); assert.equal(ownsOrder({ email: 'legacy@example.test' }, { id: 'legacy-id', email: 'LEGACY@example.test' }), true); });
test('delivery quotes and plan settings validate prices, limits and offer IDs', async () => { assert.equal(deliveryCharge(100, { ...defaultCommerceSettings, shippingFee: 60, freeShippingAbove: 500 }), 60); assert.equal(deliveryCharge(500, { ...defaultCommerceSettings, shippingFee: 60, freeShippingAbove: 500 }), 0); (await assert.rejects(async () => validateCommerceSettings({ ...defaultCommerceSettings, previewCost: 0 }))); (await assert.rejects(async () => validateCommerceSettings({ ...defaultCommerceSettings, creditPacks: [{ ...defaultCommerceSettings.creditPacks[0], price: -1 }] }))); (await assert.rejects(async () => validateCommerceSettings({ ...defaultCommerceSettings, creditPacks: [defaultCommerceSettings.creditPacks[0], defaultCommerceSettings.creditPacks[0]] }))); });
