import { database } from '@/lib/storage';
import { saveProduct } from '@/lib/product-write';
import { NextResponse } from 'next/server';
export async function GET() {
  try { return NextResponse.json((await database().prepare('SELECT * FROM products WHERE deleted_at IS NULL ORDER BY id DESC').all()).results); }
  catch { return NextResponse.json({ error: 'Catalog unavailable' }, { status: 503 }); }
}
export async function POST(request: Request) { return saveProduct(request); }
