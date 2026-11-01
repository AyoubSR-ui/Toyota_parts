import { NextResponse } from 'next/server';
import { findStore,storeProfile,storeProducts,storeProductCount } from '@/lib/stores';
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){try{
 const member=await findStore((await params).slug);if(!member)return NextResponse.json({error:'المتجر غير موجود أو غير منشور'},{status:404});
 const url=new URL(request.url),query=url.searchParams.get('q')||'',brand=url.searchParams.get('brand')||'',featured=url.searchParams.get('view')!=='inventory';
 const productValue=url.searchParams.get('product'),productId=productValue===null?undefined:Number(productValue);
 if(productId!==undefined&&(!/^[1-9]\d*$/.test(productValue!)||!Number.isSafeInteger(productId)))return NextResponse.json({error:'Invalid product'},{status:400});
 const pageSize=48,total=await storeProductCount(member.id,query,brand,featured,productId),requested=Number(url.searchParams.get('page')||1);
 const page=Math.min(Math.max(1,Math.ceil(total/pageSize)),Number.isSafeInteger(requested)&&requested>0?requested:1);
 const products=await storeProducts(member.id,query,brand,featured,pageSize,(page-1)*pageSize,productId);
 return NextResponse.json({store:storeProfile(member),products,total,page,pageSize,hasMore:page*pageSize<total,limited:false},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'تعذر تحميل المتجر'},{status:503});}}
