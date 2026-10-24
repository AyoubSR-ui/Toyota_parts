import { database, images } from '@/lib/storage';
import { isAdmin } from '@/lib/admin-auth';
import { NextResponse } from 'next/server';
import type { Product } from '@/lib/catalog';

const maxImageBytes = 5 * 1024 * 1024;
const imageTypes: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export async function saveProduct(request: Request, id?: number) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (Number(request.headers.get('content-length')) > maxImageBytes + 64 * 1024) return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 413 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Invalid form' }, { status: 400 });
  const value = (name: string) => form.get(name);
  const optional = (name: string, max: number) => typeof value(name) === 'string' ? String(value(name)).trim().slice(0, max) || null : null;
  const brand = value('brand'); const nameEn = value('nameEn'); const nameAr = value('nameAr');
  const partType = value('partType'); const price = optional('price', 80);
  if (!['Toyota', 'Nissan'].includes(String(brand)) || !valid(nameEn, 120) || !valid(nameAr, 120) || !['original', 'commercial'].includes(String(partType))) {
    return NextResponse.json({ error: 'Check names, brand and part type / تحقق من الأسماء والعلامة ونوع القطعة' }, { status: 400 });
  }
  if (price !== null && (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) > 999999999999)) {
    return NextResponse.json({ error: 'Enter a valid price in DZD / أدخل سعراً صحيحاً بالدينار الجزائري' }, { status: 400 });
  }
  const image = value('image');
  const hasImage = image instanceof File && image.size > 0;
  if (hasImage && (image.size > maxImageBytes || !imageTypes[image.type] || !(await matchesSignature(image)))) return NextResponse.json({ error: 'Choose a JPG, PNG, or WebP image up to 5 MB' }, { status: 400 });
  let newImageKey: string | null = null;
  try {
    const existing = id ? await database().prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').bind(id).first<Product>() : null;
    if (id && !existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    let imageKey = value('removeImage') === 'on' ? null : existing?.image_key || null;
    if (hasImage) {
      newImageKey = `products/${crypto.randomUUID()}.${imageTypes[image.type]}`;
      await images().put(newImageKey, image.stream(), { httpMetadata: { contentType: image.type } });
      imageKey = newImageKey;
    }
    const values = [brand, String(nameEn).trim(), String(nameAr).trim(), optional('reference', 100), optional('model', 100), optional('years', 80), optional('descriptionEn', 500), optional('descriptionAr', 500), price === null ? null : String(Number(price)), imageKey, partType, optional('manufactureCountry', 80)];
    if (id) {
      const result = await database().prepare('UPDATE products SET brand=?,name_en=?,name_ar=?,reference=?,model=?,years=?,description_en=?,description_ar=?,price=?,image_key=?,part_type=?,manufacture_country=? WHERE id=? AND deleted_at IS NULL').bind(...values, id).run();
      if (!result.meta.changes) {
        if (newImageKey) await images().delete(newImageKey);
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      return NextResponse.json({ id });
    }
    const result = await database().prepare('INSERT INTO products (brand,name_en,name_ar,reference,model,years,description_en,description_ar,price,image_key,part_type,manufacture_country,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values, new Date().toISOString()).run();
    return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
  } catch {
    if (newImageKey) await images().delete(newImageKey).catch(() => {});
    return NextResponse.json({ error: 'Could not save product / تعذر حفظ المنتج' }, { status: 503 });
  }
}
function valid(value: FormDataEntryValue | null, max: number) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
async function matchesSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b);
  return file.type === 'image/webp' && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
}
