import { env } from 'cloudflare:workers';
import { isAdmin } from '@/lib/admin-auth';
import { NextResponse } from 'next/server';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const imageTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function GET() {
  try {
    const result = await env.DB!.prepare('SELECT * FROM products ORDER BY id DESC').all();
    return NextResponse.json(result.results);
  } catch {
    return NextResponse.json({ error: 'Catalog unavailable' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const length = Number(request.headers.get('content-length'));
  if (length > MAX_IMAGE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Invalid form' }, { status: 400 });
  const field = (name: string) => form.get(name);
  const brand = field('brand');
  const nameEn = field('nameEn');
  const nameAr = field('nameAr');
  if (!['Toyota', 'Nissan'].includes(String(brand)) || !valid(nameEn, 120) || !valid(nameAr, 120)) {
    return NextResponse.json({ error: 'Invalid product' }, { status: 400 });
  }

  const image = field('image');
  let imageKey: string | null = null;
  if (image instanceof File && image.size > 0) {
    if (image.size > MAX_IMAGE_BYTES || !imageTypes[image.type] || !(await matchesSignature(image))) {
      return NextResponse.json({ error: 'Choose a JPG, PNG, or WebP image up to 5 MB' }, { status: 400 });
    }
    imageKey = `products/${crypto.randomUUID()}.${imageTypes[image.type]}`;
  }

  try {
    if (imageKey && image instanceof File) {
      await env.BUCKET!.put(imageKey, image.stream(), { httpMetadata: { contentType: image.type } });
    }
    const result = await env.DB!.prepare(
      'INSERT INTO products (brand,name_en,name_ar,reference,model,years,description_en,description_ar,price,image_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    ).bind(
      brand, String(nameEn).trim(), String(nameAr).trim(), optional(field('reference'), 100),
      optional(field('model'), 100), optional(field('years'), 80),
      optional(field('descriptionEn'), 500), optional(field('descriptionAr'), 500),
      optional(field('price'), 80), imageKey, new Date().toISOString(),
    ).run();
    return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
  } catch {
    if (imageKey) await env.BUCKET?.delete(imageKey).catch(() => {});
    return NextResponse.json({ error: 'Could not save product' }, { status: 503 });
  }
}

function valid(value: FormDataEntryValue | null, max: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
function optional(value: FormDataEntryValue | null, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : null;
}
async function matchesSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (file.type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}
