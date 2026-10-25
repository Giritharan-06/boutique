import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from './database';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { initialShop, reduceShop, type Product, type Shop } from '../../app/model';
const collectionImages: Record<string, string> = { 'Sarees': 'sarees', 'Chudithar': 'chudithar', 'Lehengas & Occasionwear': 'occasionwear', 'Contemporary': 'contemporary' };
function currentCatalogue(source: Shop): Shop {
    const saved = new Map(source.products.map(product => [product.id, product]));
    const seedIds = new Set(initialShop.products.map(product => product.id));
    const products = initialShop.products.map(seed => {
        const old = saved.get(seed.id);
        if (!old)
            return seed;
        if (old.imageSet)
            return { ...seed, ...old, images: old.images || [] };
        return { ...seed, price: old.price, stock: old.stock };
    });
    for (const old of source.products) {
        if (seedIds.has(old.id))
            continue;
        const product: Product = { ...old, images: old.images || [], imageSet: old.imageSet || collectionImages[old.category] || 'contemporary', imageIndex: Number.isInteger(old.imageIndex) ? old.imageIndex : 0, description: old.description || 'A thoughtfully made piece for your wardrobe.', craft: old.craft || 'Carefully finished details.', includes: old.includes || 'One garment as pictured.', fit: old.fit || 'Please consult the size guide for your best fit.', care: old.care || 'Follow the garment care label.' };
        products.push(product);
    }
    return { ...source, products };
}
let catalogueReady=false;
async function database() {
    const db = await openDatabase();
    if(catalogueReady)return db;
    try{
    await db.exec('BEGIN IMMEDIATE');
    if (!(await db.prepare('SELECT id FROM shop WHERE id=1').get())) {
        let initial: Shop = structuredClone(initialShop);
        const oldDir = join(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
        if (db.dialect === 'sqlite' && existsSync(oldDir))
            for (const name of readdirSync(oldDir).filter(n => n.endsWith('.sqlite') && n !== 'metadata.sqlite')) {
                let old: DatabaseSync | undefined;
                try {
                    old = new DatabaseSync(join(oldDir, name), { readOnly: true });
                    const row = old.prepare('SELECT data FROM shops WHERE owner=?').get('local_seedy') as {
                        data: string;
                    } | undefined;
                    if (row) {
                        initial = JSON.parse(row.data);
                        break;
                    }
                }
                catch { }
                finally {
                    old?.close();
                }
            }
        (await db.prepare('INSERT OR IGNORE INTO shop(id,data,revision) VALUES(1,?,0)').run(JSON.stringify(currentCatalogue(initial))));
    }
    const row = (await db.prepare('SELECT data FROM shop WHERE id=1').get()) as {
        data: string;
    };
    const migrated = JSON.stringify(currentCatalogue(JSON.parse(row.data) as Shop));
    if (migrated !== row.data)
        (await db.prepare('UPDATE shop SET data=?,revision=revision+1 WHERE id=1').run(migrated));
    await db.exec('COMMIT');
    catalogueReady=true;
    return db;
    }catch(error){await db.exec('ROLLBACK').catch(()=>{});db.close();throw error;}
}
export async function readShop() { const db = (await database()); try {
    const row = (await db.prepare('SELECT data,revision FROM shop WHERE id=1').get()) as {
        data: string;
        revision: number;
    };
    return { shop: JSON.parse(row.data) as Shop, revision: row.revision, user: 'Local boutique' };
}
finally {
    db.close();
} }
export async function updateShop(revision: number, action: unknown) { const db = (await database()); try {
    (await db.exec('BEGIN IMMEDIATE'));
    const row = (await db.prepare('SELECT data,revision FROM shop WHERE id=1').get()) as {
        data: string;
        revision: number;
    };
    if (row.revision !== revision) {
        (await db.exec('ROLLBACK'));
        return null;
    }
    const shop = reduceShop(JSON.parse(row.data), action);
    (await db.prepare('UPDATE shop SET data=?, revision=revision+1 WHERE id=1').run(JSON.stringify(shop)));
    (await db.exec('COMMIT'));
    return { shop, revision: revision + 1 };
}
catch (e) {
    try {
        (await db.exec('ROLLBACK'));
    }
    catch { }
    throw e;
}
finally {
    db.close();
} }
export async function registerCustomer(account: {
    id: string;
    name: string;
    email: string;
    phone: string;
}) { const db = (await database()); try {
    (await db.exec('BEGIN IMMEDIATE'));
    const row = (await db.prepare('SELECT data FROM shop WHERE id=1').get()) as {
        data: string;
    };
    const shop = JSON.parse(row.data) as Shop;
    if (!shop.customers.some(customer => customer.email.toLowerCase() === account.email.toLowerCase())) {
        shop.customers.unshift({ id: account.id, name: account.name, email: account.email, phone: account.phone, notes: 'Online customer account' });
        (await db.prepare('UPDATE shop SET data=?,revision=revision+1 WHERE id=1').run(JSON.stringify(shop)));
    }
    (await db.exec('COMMIT'));
}
catch (e) {
    try {
        (await db.exec('ROLLBACK'));
    }
    catch { }
    throw e;
}
finally {
    db.close();
} }
