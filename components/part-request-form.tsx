'use client';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { normalizeAlgerianWhatsApp } from '@/lib/whatsapp';
import { requestFields, type FieldKey, type FormSettings } from '@/lib/form-fields';
export function PartRequestForm({ar,partName,brand,onPartNameChange,onBrandChange,onSubmitted}:{ar:boolean;partName:string;brand:string;onPartNameChange:(value:string)=>void;onBrandChange:(value:string)=>void;onSubmitted:()=>void}) {
  const [settings,setSettings]=useState<FormSettings|null>(null);const [loadError,setLoadError]=useState(false);
  const [orderType,setOrderType]=useState('');const [status,setStatus]=useState('');const [failed,setFailed]=useState(false);const [sending,setSending]=useState(false);
  const [photo,setPhoto]=useState<string|null>(null);const imageRef=useRef<HTMLInputElement>(null);const phoneRef=useRef<HTMLInputElement>(null);
  async function load(){setLoadError(false);try{const response=await fetch('/api/form-settings',{cache:'no-store'});if(!response.ok)throw Error();setSettings(await response.json());}catch{setLoadError(true);}}
  useEffect(()=>{void load()},[]);useEffect(()=>()=>{if(photo)URL.revokeObjectURL(photo)},[photo]);
  function error(message:string){setStatus(message);setFailed(true);}
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!settings)return;const form=event.currentTarget;const data=new FormData(form);
    const rawPhone=String(data.get('phone')||'').trim();
    if(rawPhone){const phone=normalizeAlgerianWhatsApp(rawPhone);if(!phone){const message=ar?'أدخل رقم واتساب جزائري صحيحاً، مثل 555123456.':'Enter a valid Algerian WhatsApp number, e.g. 555123456.';phoneRef.current?.setCustomValidity(message);phoneRef.current?.reportValidity();return;}data.set('phone',phone);}
    if(![...data.values()].some(value=>value instanceof File?value.size>0:value.trim())){error(ar?'يرجى إدخال معلومة واحدة على الأقل.':'Please provide at least one detail.');return;}
    setSending(true);setStatus('');setFailed(false);
    try{const response=await fetch('/api/leads',{method:'POST',body:data});if(!response.ok){await load();throw Error();}const result=await response.json() as {id:number};setStatus(ar?`تم استلام طلبك رقم ${result.id}. سنتواصل معك قريباً.`:`Request #${result.id} received. We will contact you soon.`);form.reset();setPhoto(null);setOrderType('');onSubmitted();}
    catch{error(ar?'تعذر إرسال الطلب. تحقق من الحقول المطلوبة وحاول مجدداً.':'Could not send your request. Check the required fields and try again.');}finally{setSending(false);}
  }
  if(!settings)return <div className="form-card"><p role="status">{loadError?(ar?'تعذر تحميل النموذج.':'Could not load the form.'):(ar?'جارٍ تحميل النموذج…':'Loading request form…')}</p>{loadError&&<button className="secondary-button" onClick={load}>{ar?'حاول مجدداً':'Try again'}</button>}</div>;
  function label(key:FieldKey){const field=requestFields.find(field=>field.key===key)!;return (ar?field.ar:field.en)+(settings!.fields[key].required?' *':ar?' (اختياري)':' (optional)');}
  return <form className="form-card" onSubmit={submit}><div className="form-grid">{requestFields.filter(({key})=>settings.fields[key].visible&&(key!=='quantity'||orderType==='wholesale'||!settings.fields.orderType.visible)).map(({key})=>{
    const required=settings.fields[key].required;
    const wide=['vinFrame','image','note'].includes(key);
    let input;
    switch(key){
      case 'name':input=<Input name={key} required={required} maxLength={100} autoComplete="name" placeholder={ar?'أدخل اسمك الكامل':'Enter your full name'}/>;break;
      case 'phone':input=<><div className="whatsapp-input" dir="ltr"><span className="phone-prefix" aria-hidden="true">+213</span><Input ref={phoneRef} name={key} type="tel" autoComplete="tel-national" inputMode="tel" required={required} maxLength={30} placeholder={ar?'أدخل رقم واتساب الخاص بك':'Enter your WhatsApp number'} onChange={event=>event.target.setCustomValidity('')} onBlur={event=>{const phone=normalizeAlgerianWhatsApp(event.target.value);if(phone)event.target.value=phone.slice(4);}}/></div><span className="muted field-hint">{ar?'مثال: 555123456 — رمز الجزائر +213 ثابت.':'e.g. 555123456 — Algeria code +213 is fixed.'}</span></>;break;
      case 'brand':input=<select name={key} required={required} value={brand} onChange={event=>onBrandChange(event.target.value)}><option value="" disabled={required}>{ar?'اختر علامة السيارة':'Choose your car brand'}</option><option>Toyota</option><option>Nissan</option></select>;break;
      case 'partName':input=<Input name={key} required={required} maxLength={150} value={partName} onChange={event=>onPartNameChange(event.target.value)} placeholder={ar?'أدخل اسم القطعة (مثال: فحمات الفرامل)':'Enter the part name (e.g. brake pads)'}/>;break;
      case 'reference':input=<Input name={key} required={required} maxLength={100} placeholder={ar?'مثال: 04465-0K240':'e.g. 04465-0K240'}/>;break;
      case 'model':input=<Input name={key} required={required} maxLength={100} placeholder={ar?'أدخل الموديل (مثال: Corolla)':'Enter car model (e.g. Corolla)'}/>;break;
      case 'year':input=<Input name={key} required={required} type="number" min="1950" max={new Date().getFullYear()+1} placeholder={ar?'مثال: 2020':'e.g. 2020'}/>;break;
      case 'orderType':input=<select name={key} required={required} value={orderType} onChange={event=>setOrderType(event.target.value)}><option value="" disabled={required}>{ar?'اختر نوع الطلب':'Choose order type'}</option><option value="single">{ar?'قطعة واحدة':'One piece'}</option><option value="wholesale">{ar?'جملة':'Wholesale'}</option></select>;break;
      case 'quantity':input=<Input name={key} required={required} type="number" min="1" step="1" placeholder={ar?'مثال: 10 قطع':'e.g. 10 pieces'}/>;break;
      case 'vinFrame':input=<Input name={key} required={required} maxLength={50} pattern="[A-Za-z0-9 -]+" dir="ltr" placeholder={ar?'أدخل VIN أو رقم الهيكل (مثال: KUN26-123456)':'Enter VIN or frame (e.g. KUN26-123456)'}/>;break;
      case 'image':input=<><Input ref={imageRef} name={key} required={required} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file&&(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))){event.target.value='';setPhoto(null);error(ar?'اختر صورة JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميغابايت.':'Choose a JPG, PNG or WebP image up to 5 MB.');return;}setStatus('');setPhoto(file?URL.createObjectURL(file):null);}}/><span className="muted field-hint">{ar?'JPG أو PNG أو WebP، حتى 5 ميغابايت. تظهر الصورة للإدارة فقط.':'JPG, PNG or WebP · up to 5 MB. Visible only to the admin.'}</span></>;break;
      case 'note':input=<Textarea name={key} required={required} maxLength={1000} placeholder={ar?'أضف تفاصيل عن القطعة أو السيارة':'Add details about the part or your car'}/>;break;
    }
    return <div className={wide?'span2':''} key={key}><label className="field">{label(key)}{input}</label>{key==='image'&&photo&&<div className="request-photo-preview"><img className="upload-preview" src={photo} alt={ar?'معاينة صورة القطعة':'Part photo preview'}/><button type="button" className="secondary-button" onClick={()=>{setPhoto(null);if(imageRef.current)imageRef.current.value='';}}>{ar?'إزالة الصورة':'Remove photo'}</button></div>}</div>;
  })}<Button className="span2" disabled={sending} type="submit">{sending?'...':ar?'إرسال الطلب':'Send request'}</Button></div>{status&&<div role="status" className={'notice '+(failed?'error':'')}>{status}</div>}</form>;
}
