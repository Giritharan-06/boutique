import {timingSafeEqual} from 'node:crypto';
import {cleanupStudio} from '../../../../lib/fashion-studio/store';
export const dynamic='force-dynamic';
export async function GET(req:Request){const expected=process.env.CRON_SECRET;if(!expected)return Response.json({error:'Unavailable'},{status:503});const actual=req.headers.get('authorization')||'',wanted='Bearer '+expected;if(Buffer.byteLength(actual)!==Buffer.byteLength(wanted)||!timingSafeEqual(Buffer.from(actual),Buffer.from(wanted)))return Response.json({error:'Unauthorized'},{status:401});await cleanupStudio();return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});}
