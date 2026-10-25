import {readJob,cancelJob} from '../../../../lib/local/try-on';
import {localRequest} from '../../../../lib/local/security';
import {getAuthUser} from '../../../../lib/local/auth';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,{params}:Context){if(!localRequest(req))return Response.json({error:'Local access only.'},{status:403});const owners=[getAuthUser(req,'customer'),getAuthUser(req,'admin')].filter(user=>user!==null);if(!owners.length)return Response.json({error:'Please sign in.'},{status:401});const id=(await params).id;const job=owners.map(user=>readJob(id,user.id)).find(job=>job!==null);return Response.json(job??{error:'This preview expired. Generate a new one.'},{status:job?200:404,headers:{'Cache-Control':'no-store'}});}
export async function DELETE(req:Request,{params}:Context){if(!localRequest(req,true))return Response.json({error:'Invalid request.'},{status:403});const owners=[getAuthUser(req,'customer'),getAuthUser(req,'admin')].filter(user=>user!==null);if(!owners.length)return Response.json({error:'Please sign in.'},{status:401});const id=(await params).id;return Response.json({cancelled:owners.some(user=>cancelJob(id,user.id))});}
