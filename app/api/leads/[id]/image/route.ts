import { database, images } from '@/lib/storage';
import { isAdmin } from '@/lib/admin-auth';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  // Customer photos are private and never exposed through the public catalog.
  if(!(await isAdmin()))return new Response('Unauthorized',{status:401,headers:{'Cache-Control':'private, no-store'}});
  const {id}=await params;
  if(!/^[1-9]\d*$/.test(id))return new Response('Not found',{status:404});
  try{
    const row=await database().prepare('SELECT image_key FROM leads WHERE id=?').bind(Number(id)).first<{image_key:string|null}>();
    if(!row?.image_key)return new Response('Not found',{status:404});
    const object=await images().get(row.image_key);
    if(!object)return new Response('Not found',{status:404});
    return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename="request-${id}-photo"`}});
  }catch{return new Response('Image unavailable',{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
