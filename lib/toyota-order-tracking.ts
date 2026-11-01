import { parseCatalogFields } from '@/lib/catalog-fields';
export const toyotaPixelId='3676036822560836';
export type OrderTracking={event:'Purchase'|'Lead';eventId:string;data:{currency?:'DZD';value?:number;content_type?:'product';content_ids?:string[];contents?:{id:string;quantity:number;item_price:number}[];num_items?:number}};
type CatalogOrder={id:number;unitPrice:number;quantity:number;value:number};
type Item={id:number;name:string;name_en:string|null;name_fr:string|null;reference:string|null;price:string|null;show_price:number;catalog_fields:string|null};
const normalize=(value:string)=>value.trim().toLocaleLowerCase();
const referenceMatches=(stored:string|null,input:string)=>{const key=(value:string)=>value.toUpperCase().replace(/[\s-]/g,'');return !!stored&&[stored,...stored.split(/[\/;,]/)].some(value=>key(value)===key(input));};
export async function resolveToyotaCatalogOrder(db:D1Database,store:{id:number;show_prices:number;store_slug:string|null},fields:{partName?:string;reference?:string;orderType?:string;quantity?:string},inventoryId:unknown):Promise<CatalogOrder|null>{
 if(store.store_slug!=='toyota-parts'||store.show_prices!==1)return null;
 const quantity=fields.quantity?Number(fields.quantity):fields.orderType==='wholesale'?NaN:1;
 if(!Number.isSafeInteger(quantity)||quantity<1)return null;
 const base='SELECT id,name,name_en,name_fr,reference,price,show_price,catalog_fields FROM inventory WHERE owner_id=? AND deleted_at IS NULL AND quantity>0';
 let rows:Item[];
 if(inventoryId!==undefined&&inventoryId!==null&&inventoryId!==''){if(!/^[1-9]\d*$/.test(String(inventoryId))||!Number.isSafeInteger(Number(inventoryId)))return null;const item=await db.prepare(base+' AND id=?').bind(store.id,Number(inventoryId)).first<Item>();rows=item?[item]:[];}
 else if(fields.reference){rows=(await db.prepare(base+" AND LOWER(REPLACE(REPLACE(reference,'-',''),' ',''))=? LIMIT 2").bind(store.id,normalize(fields.reference).replace(/[\s-]/g,'')).all()).results as Item[];}
 else if(fields.partName){const name=normalize(fields.partName);rows=(await db.prepare(base+" AND (LOWER(name)=? OR LOWER(name_en)=? OR LOWER(name_fr)=?) LIMIT 2").bind(store.id,name,name,name).all()).results as Item[];}
 else return null;
 if(rows.length!==1)return null;const item=rows[0],visible=parseCatalogFields(item.catalog_fields);
 if(item.show_price!==1||!visible?.price||item.price===null||!/^\d+(\.\d{1,2})?$/.test(item.price))return null;
 if(fields.partName&&![item.name,item.name_en,item.name_fr].some(name=>name&&normalize(name)===normalize(fields.partName!)))return null;
 if(fields.reference&&!referenceMatches(item.reference,fields.reference))return null;
 const cents=Math.round(Number(item.price)*100),total=cents*quantity;
 if(!Number.isSafeInteger(cents)||!Number.isSafeInteger(total)||total<0)return null;
 return {id:item.id,unitPrice:cents/100,quantity,value:total/100};
}
export function toyotaOrderTracking(id:number,order:CatalogOrder|null):OrderTracking{
 return order?{event:'Purchase',eventId:'toyota-parts-order-'+id,data:{currency:'DZD',value:order.value,content_type:'product',content_ids:[String(order.id)],contents:[{id:String(order.id),quantity:order.quantity,item_price:order.unitPrice}],num_items:order.quantity}}:{event:'Lead',eventId:'toyota-parts-request-'+id,data:{}};
}
