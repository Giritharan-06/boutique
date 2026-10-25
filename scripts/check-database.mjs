import {databaseRuntime} from './database-runtime.mjs';
const load=await databaseRuntime();
const {databaseMode,postgresPool,openDatabase,closeDatabasePool}=await load('database');
try{
  if(databaseMode()!=='postgres')throw Error('Set DATABASE_URL in .env.local before checking PostgreSQL.');
  const pool=postgresPool();
  const client=await pool.connect();
  try{const status=await client.query('SELECT current_database() AS database');const encrypted=client.connection.stream.encrypted===true;if(!encrypted)throw Error('TLS is required.');console.log(JSON.stringify({connected:true,database:status.rows[0].database,encrypted}));}finally{client.release();}
  if(process.argv.includes('--inventory')){
    const tables=await pool.query("SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema,table_name");
    console.log(JSON.stringify({tables:tables.rows}));
    const visible=await pool.query('SHOW search_path');console.log(JSON.stringify({defaultSearchPath:visible.rows[0].search_path}));
    if(tables.rows.some(row=>row.table_schema==='aarini'&&row.table_name==='shop')){const shop=await pool.query('SELECT data FROM aarini.shop WHERE id=1');const data=JSON.parse(shop.rows[0].data);console.log(JSON.stringify({products:data.products.length,customers:data.customers.length,orders:data.orders.length}));}
  }
  if(process.argv.includes('--counts')){const d=await openDatabase();try{const counts={};for(const table of ['accounts','shop','sessions','ai_purchases','preview_usage','product_images'])counts[table]=(await d.prepare('SELECT COUNT(*) AS count FROM '+table).get()).count;console.log(JSON.stringify({schema:'aarini',counts}));}finally{d.close();}}
}catch(error){console.error('Database check failed ('+(error.code||error.name)+'). Connection details were not printed.');process.exitCode=1;}finally{await closeDatabasePool();}
