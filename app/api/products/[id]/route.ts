import { database } from '@/lib/storage';
import { isAdmin } from '@/lib/admin-auth';
import { saveProduct } from '@/lib/product-write';
import { NextResponse } from 'next/server';
type Context = { params: Promise<{ id: string }> };
async function productId(context: Context) { const { id } = await context.params; return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) ? Number(id) : null; }
export async function PUT(request: Request, context: Context) {
  const id = await productId(context);
  return id ? saveProduct(request, id) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
async function setDeleted(context: Context, deleted: boolean) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = await productId(context);
  if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const result = await database().prepare(deleted ? 'UPDATE products SET deleted_at=? WHERE id=? AND deleted_at IS NULL' : 'UPDATE products SET deleted_at=? WHERE id=? AND deleted_at IS NOT NULL').bind(deleted ? new Date().toISOString() : null, id).run();
    return result.meta.changes ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Could not update product / تعذر تحديث المنتج' }, { status: 503 }); }
}
export async function DELETE(_request: Request, context: Context) { return setDeleted(context, true); }
export async function PATCH(request: Request, context: Context) {
  const body = await request.json().catch(() => null) as { restore?: unknown } | null;
  if (body?.restore !== true) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  return setDeleted(context, false);
}
