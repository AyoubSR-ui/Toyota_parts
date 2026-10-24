export type Product = {
  id: number; brand: string; name_en: string; name_ar: string; reference: string | null;
  model: string | null; years: string | null; description_en: string | null;
  description_ar: string | null; price: string | null; image_key: string | null;
  part_type: 'original' | 'commercial' | null; manufacture_country: string | null;
};
export function formatPrice(price: string | null, ar = false) {
  if (price === null || price === '') return '';
  const number = Number(price);
  return `${Number.isFinite(number) ? new Intl.NumberFormat(ar ? 'ar-DZ' : 'en-GB', { maximumFractionDigits: 2 }).format(number) : price} DZD`;
}
export function partTypeLabel(type: Product['part_type'], ar = false) {
  return type === 'original' ? (ar ? 'أصلي' : 'Original') : type === 'commercial' ? (ar ? 'تجاري' : 'Commercial') : '';
}
export function productImage(product: Product) {
  return `/api/products/${product.id}/image?v=${encodeURIComponent(product.image_key || '')}`;
}
