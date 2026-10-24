import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { database } from '@/lib/storage';
import { parseFormSettings } from '@/lib/form-fields';
import { readFormSettings } from '@/lib/form-settings';
const headers={'Cache-Control':'no-store'};
export async function GET(){try{return NextResponse.json(await readFormSettings(),{headers});}catch{return NextResponse.json({error:'Form settings unavailable'},{status:503,headers});}}
export async function PUT(request:Request){
  if(!(await isAdmin()))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
  const settings=parseFormSettings(await request.json().catch(()=>null));
  if(!settings)return NextResponse.json({error:'Check all field settings and keep at least one field visible.'},{status:400,headers});
  try{await database().prepare('INSERT INTO form_settings (id,value) VALUES (?,?) ON CONFLICT (id) DO UPDATE SET value=excluded.value').bind('part_request',JSON.stringify(settings)).run();return NextResponse.json(settings,{headers});}
  catch{return NextResponse.json({error:'Could not save form settings'},{status:503,headers});}
}
