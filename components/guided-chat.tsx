'use client';
import { useEffect, useRef, useState } from 'react';
import { PartRequestForm } from '@/components/part-request-form';
import { formatPrice, type Product } from '@/lib/catalog';

export function GuidedChat({products}:{products:Product[]}) {
  const [open,setOpen]=useState(false);
  const [view,setView]=useState<'menu'|'catalog'|'request'|'help'>('menu');
  const [query,setQuery]=useState('');
  const [part,setPart]=useState('');
  const [brand,setBrand]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  const launcher=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();},[open]);
  const matches=products.filter(product=>[product.name_ar,product.name_en,product.reference,product.brand,product.model,product.years,product.compatibility].some(value=>value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  function close(){dialog.current?.close();setOpen(false);launcher.current?.focus();}
  function request(product?:Product){setPart(product?.name_ar||'');setBrand(product?.brand||'');setView('request');}
  return <div dir="rtl" className="guided-chat">
    <button ref={launcher} className="chat-launcher" aria-haspopup="dialog" onClick={()=>setOpen(true)}>مساعد قطع الغيار</button>
    <dialog ref={dialog} className="chat-dialog" aria-labelledby="chat-title" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)}>
      <header className="chat-header"><div><strong id="chat-title">مساعد قطع الغيار</strong><small>محادثة موجهة بالعربية</small></div><button type="button" onClick={close} aria-label="إغلاق المحادثة">×</button></header>
      <div className="chat-body">
        {view!=='menu'&&<button className="secondary-button" type="button" onClick={()=>setView('menu')}>القائمة الرئيسية</button>}
        {view==='menu'&&<><p className="chat-bubble">مرحباً بك في Toyota Parts! كيف يمكننا مساعدتك؟ اختر أحد الأزرار للمتابعة.</p><div className="chat-menu"><button onClick={()=>request()}>أريد طلب قطعة</button><button onClick={()=>setView('catalog')}>الأسعار والسيارات المتوافقة</button><button onClick={()=>setView('help')}>أسئلة شائعة</button></div></>}
        {view==='help'&&<><p className="chat-bubble">نوفر طلبات قطع تويوتا ونيسان، للقطعة الواحدة أو الجملة. يمكنك إضافة الرقم المرجعي أو VIN أو صورة للمساعدة في تحديد القطعة.</p><details><summary>هل القطعة متوفرة؟</summary><p>الكتالوج يعرض القطع المسجلة. يؤكد فريقنا المخزون والتوفر عند التواصل معك.</p></details><details><summary>كيف أعرف السعر والتوافق؟</summary><p>تظهر الأسعار بالدينار الجزائري وبيانات التوافق إذا أضافها المسؤول. يجب تأكيد ملاءمة القطعة لسيارتك قبل الشراء.</p></details><details><summary>كيف أطلب قطعة غير موجودة؟</summary><p>اختر «أريد طلب قطعة» وأدخل بياناتك. سيتلقى الفريق طلبك ويتواصل معك عبر واتساب.</p></details><button className="btn btn-red" onClick={()=>request()}>أريد طلب قطعة</button></>}
        {view==='catalog'&&<><p className="chat-bubble">ابحث باسم القطعة أو المرجع أو السيارة لعرض المعلومات المسجلة.</p><label className="field">البحث في الكتالوج<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="مثال: Hilux أو رقم القطعة" type="search"/></label><p role="status">{matches.length} نتيجة</p>{matches.slice(0,20).map(product=><article className="chat-product" key={product.id}><strong>{product.name_ar}</strong><p>{product.brand}{product.reference&&<> · <bdi>{product.reference}</bdi></>}</p><p>السعر: {formatPrice(product.price,true)||'يؤكده فريقنا'}</p><p style={{whiteSpace:'pre-line'}}>السيارات المتوافقة: {product.compatibility||[product.model,product.years].filter(Boolean).join(' · ')||'يرجى تأكيد التوافق مع فريقنا'}</p><button onClick={()=>request(product)}>طلب هذه القطعة</button></article>)}{matches.length>20&&<p>أدخل تفاصيل أكثر لتضييق النتائج.</p>}{matches.length===0&&<p>لم نجد نتيجة مسجلة. يمكنك إرسال طلب وسيساعدك فريقنا.</p>}<button className="btn btn-red" onClick={()=>request()}>طلب قطعة أخرى</button></>}
        {view==='request'&&<><p className="chat-bubble">أكمل الخطوات التالية لإرسال طلبك. تُرسل بياناتك لفريق المتجر عند الضغط على «إرسال الطلب» فقط.</p><PartRequestForm ar guided partName={part} brand={brand} onPartNameChange={setPart} onBrandChange={setBrand} onSubmitted={()=>{setPart('');setBrand('');}}/></>}
      </div>
    </dialog>
  </div>;
}
