import { NextResponse } from 'next/server';
import { z } from 'zod';
import { database } from '@/lib/storage';
import { currentMember,sameOrigin } from '@/lib/member-auth';
const schema=z.object({name:z.string().trim().min(1).max(150),brand:z.string().trim().min(1).max(50),reference:z.string().trim().max(100),compatibility:z.string().trim().max(2000),price:z.union([z.string(),z.number()]).transform(String).refine(v=>/^\d+(\.\d{1,2})?$/.test(v)&&Number(v)<=999999999999),quantity:z.union([z.string().regex(/^\d+$/),z.number()]).transform(Number).refine(v=>Number.isInteger(v)&&v>=0&&v<=2147483647),partType:z.enum(['original','commercial'])});
export async function writeInventory(request:Request,id?:number){
 if(!sameOrigin(request))return NextResponse.json({error:'طلب غير مسموح'},{status:403});
 const member=await currentMember();if(!member)return NextResponse.json({error:'يرجى تسجيل الدخول'},{status:401});
 if(Number(request.headers.get('content-length'))>15000)return NextResponse.json({error:'البيانات كبيرة جداً'},{status:413});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'تحقق من اسم القطعة والعلامة والسعر والكمية ونوع القطعة'},{status:400});
 const d=parsed.data;if(!JSON.parse(member.brands).includes(d.brand))return NextResponse.json({error:'أضف هذه العلامة إلى ملفك أولاً'},{status:400});
 try{
 const values=[d.name,d.brand,d.reference||null,d.compatibility||null,String(Number(d.price)),d.quantity,d.partType];
 const result=id?await database().prepare('UPDATE inventory SET name=?,brand=?,reference=?,compatibility=?,price=?,quantity=?,part_type=? WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(...values,id,member.id).run():await database().prepare('INSERT INTO inventory (name,brand,reference,compatibility,price,quantity,part_type,owner_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(...values,member.id,new Date().toISOString()).run();
 if(id&&!result.meta.changes)return NextResponse.json({error:'القطعة غير موجودة'},{status:404});return NextResponse.json({id:id||result.meta.last_row_id},{status:id?200:201});
 }catch{return NextResponse.json({error:'تعذر حفظ القطعة'},{status:503});}
}
