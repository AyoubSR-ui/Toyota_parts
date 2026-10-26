import { findStore,storeProducts } from '@/lib/stores';
import { saveProduct } from '@/lib/product-write';
import { NextResponse } from 'next/server';
// Legacy Toyota catalog reads respect the same tenant visibility rules as the new storefront.
export async function GET(){try{const store=await findStore('toyota-parts');if(!store)return NextResponse.json([]);const items=await storeProducts(store.id);return NextResponse.json(items.filter(item=>item.legacy_product_id!==null).map(item=>({...item,id:item.legacy_product_id,name_ar:item.name,name_en:item.name_en||item.name,description_ar:item.description,description_en:item.description,image_url:item.image_key?`/api/inventory/${item.id}/image`:null})),{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Catalog unavailable'},{status:503});}}
export async function POST(request:Request){return NextResponse.json({error:'Manage store inventory through /api/inventory'},{status:410});}
