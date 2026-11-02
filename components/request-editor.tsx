'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocale } from '@/components/locale';

export type RequestEdit={name:string;phone:string;brand:string;partName:string;reference:string;model:string;year:string;orderType:string;quantity:string;vinFrame:string;adminNote:string};
type RequestDetails={id:number;name:string|null;phone:string|null;brand:string|null;part_name:string|null;reference:string|null;model:string|null;year:number|null;order_type:string|null;quantity:number|null;vin_frame:string|null;note:string|null;admin_note:string|null};
export function RequestEditor({lead,busy,onSave,onClose}:{lead:RequestDetails;busy:boolean;onSave:(data:Partial<RequestEdit>)=>Promise<boolean>;onClose:()=>void}){
 const {locale}=useLocale();
 const tr=(ar:string,en:string,fr:string)=>locale==='ar'?ar:locale==='fr'?fr:en;
 const dialog=useRef<HTMLDialogElement>(null);
 const [error,setError]=useState('');
 const [draft,setDraft]=useState<RequestEdit>({name:lead.name||'',phone:lead.phone||'',brand:lead.brand||'',partName:lead.part_name||'',reference:lead.reference||'',model:lead.model||'',year:lead.year?String(lead.year):'',orderType:lead.order_type||'',quantity:lead.quantity?String(lead.quantity):'',vinFrame:lead.vin_frame||'',adminNote:lead.admin_note||''});
 const original=useRef(draft);const changed=(Object.keys(draft) as (keyof RequestEdit)[]).some(key=>draft[key]!==original.current[key]);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
 function field(key:keyof RequestEdit,value:string){setDraft(previous=>({...previous,[key]:value}));setError('');}
 async function save(event:FormEvent){event.preventDefault();if(busy)return;setError('');const changes=Object.fromEntries(Object.entries(draft).filter(([key,value])=>value!==original.current[key as keyof RequestEdit])) as Partial<RequestEdit>;if(!Object.keys(changes).length)return;if(await onSave(changes))onClose();else setError(tr('تعذر الحفظ. تحقق من البيانات وحاول مجدداً.','Could not save. Check the details and retry.','Enregistrement impossible. Vérifiez les données et réessayez.'));}
 const labels={name:tr('اسم العميل','Customer name','Nom du client'),phone:tr('رقم واتساب','WhatsApp number','Numéro WhatsApp'),brand:tr('علامة السيارة','Car brand','Marque du véhicule'),partName:tr('اسم القطعة','Part name','Nom de la pièce'),reference:tr('المرجع','Reference','Référence'),model:tr('موديل السيارة','Car model','Modèle du véhicule'),vinFrame:tr('VIN أو رقم الهيكل','VIN or frame number','VIN ou numéro de châssis')};
 return <dialog ref={dialog} className="request-editor" dir={locale==='ar'?'rtl':'ltr'} aria-labelledby="request-editor-title" aria-describedby="request-editor-description" onCancel={event=>{if(busy)event.preventDefault();else onClose();}}>
  <form onSubmit={event=>void save(event)}>
   <header className="request-editor-header"><div><h2 id="request-editor-title">{tr('تعديل الطلب','Edit request','Modifier la demande')} #{lead.id}</h2><p id="request-editor-description">{tr('عدّل التفاصيل وأضف ملاحظات داخلية لفريق متجرك.','Update details and add internal notes for your store team.','Modifiez les détails et ajoutez des notes internes pour votre boutique.')}</p></div><button type="button" className="secondary-button" aria-label={tr('إغلاق','Close','Fermer')} disabled={busy} onClick={onClose}>×</button></header>
   <fieldset disabled={busy} className="request-editor-fields"><div className="form-grid">
    {(Object.keys(labels) as (keyof typeof labels)[]).map(key=><label className="field" key={key}>{labels[key]}<input value={draft[key]} onChange={event=>field(key,event.target.value)} type={key==='phone'?'tel':'text'} dir={key==='phone'||key==='vinFrame'||key==='reference'?'ltr':undefined} maxLength={key==='partName'?150:key==='brand'||key==='vinFrame'?50:100}/></label>)}
    <label className="field">{tr('سنة السيارة','Vehicle year','Année du véhicule')}<input type="number" min="1950" max={new Date().getFullYear()+1} step="1" value={draft.year} onChange={event=>field('year',event.target.value)}/></label>
    <label className="field">{tr('نوع الطلب','Order type','Type de commande')}<select value={draft.orderType} onChange={event=>{field('orderType',event.target.value);if(event.target.value==='single')field('quantity','1');}}><option value="">{tr('غير محدد','Not specified','Non précisé')}</option><option value="single">{tr('قطعة واحدة','Single piece','Une pièce')}</option><option value="wholesale">{tr('جملة','Wholesale','Gros')}</option></select></label>
    <label className="field">{tr('الكمية المطلوبة','Requested quantity','Quantité demandée')}{draft.orderType==='wholesale'?' *':''}<input type="number" min="1" max="2147483647" step="1" required={draft.orderType==='wholesale'&&(draft.orderType!==original.current.orderType||draft.quantity!==original.current.quantity)} readOnly={draft.orderType==='single'} value={draft.orderType==='single'?'1':draft.quantity} onChange={event=>field('quantity',event.target.value)}/></label>
   </div>
   <div className="request-customer-note"><strong>{tr('ملاحظة العميل الأصلية','Original customer note','Note originale du client')}</strong><p>{lead.note||tr('لا توجد ملاحظة.','No customer note.','Aucune note du client.')}</p></div>
   <label className="field request-internal-note">{tr('ملاحظة داخلية للإدارة','Internal admin note','Note interne de gestion')}<textarea rows={4} maxLength={5000} value={draft.adminNote} onChange={event=>field('adminNote',event.target.value)} placeholder={tr('مثال: تم الاتصال بالعميل، بانتظار تأكيد المرجع.','Example: Called customer; waiting for reference confirmation.','Exemple : Client contacté, en attente de confirmation de la référence.')}/><small>{tr('تظهر لإدارة متجرك فقط، ولا تستبدل ملاحظة العميل.','Visible only to your store admin team; keeps the customer note intact.','Visible uniquement par la gestion de votre boutique, sans modifier la note du client.')}</small></label>
   </fieldset>
   {error&&<p className="notice error" role="alert">{error}</p>}
   <footer className="request-editor-footer"><button className="btn btn-red" type="submit" disabled={busy||!changed}>{busy?tr('جارٍ الحفظ…','Saving…','Enregistrement…'):tr('حفظ التعديلات','Save changes','Enregistrer')}</button><button className="secondary-button" type="button" disabled={busy} onClick={onClose}>{tr('إلغاء','Cancel','Annuler')}</button></footer>
  </form>
 </dialog>;
}
