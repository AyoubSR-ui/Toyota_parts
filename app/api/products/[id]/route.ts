import { NextResponse } from 'next/server';
function retired(){return NextResponse.json({error:'Manage store inventory through /api/inventory'},{status:410});}
export const PUT=retired;export const DELETE=retired;export const PATCH=retired;
