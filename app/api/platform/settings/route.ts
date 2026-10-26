import { NextResponse } from 'next/server';
import { platformSettings } from '@/lib/platform-admin';
export async function GET(){try{return NextResponse.json(await platformSettings(),{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Unavailable'},{status:503});}}
