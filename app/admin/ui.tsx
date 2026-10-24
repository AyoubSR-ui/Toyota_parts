'use client';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AdminHeader } from '@/components/admin-header';
import { formatPrice, partTypeLabel, productImage, type Product } from '@/lib/catalog';

export default function AdminClient({passwordLogin}:{passwordLogin:boolean}) {
  const [lang,setLang]=useState<'en'|'ar'>('en');
  const [products,setProducts]=useState<Product[]>([]);
  const [message,setMessage]=useState(''); const [loading,setLoading]=useState(false);
  const [preview,setPreview]=useState<string|null>(null); const [editing,setEditing]=useState<Product|null>(null);
  const [lastDeleted,setLastDeleted]=useState<Product|null>(null); const formRef=useRef<HTMLFormElement>(null);
  const ar=lang==='ar';
  useEffect(()=>()=>{if(preview) URL.revokeObjectURL(preview)},[preview]);
  async function refresh(){
    const p=await fetch('/api/products',{cache:'no-store'});
    if(p.ok)setProducts(await p.json());
    else setMessage(ar?'تعذر تحميل المنتجات. يرجى المحاولة مجدداً.':'Unable to load products. Please try again.');
  }
  useEffect(()=>{void refresh()},[]);
  function edit(product:Product){setEditing(product);setPreview(null);setMessage('');document.getElementById('product-editor')?.scrollIntoView({behavior:'smooth'});}
  function cancel(){setEditing(null);setPreview(null);formRef.current?.reset();}
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setLoading(true);setMessage('');const form=event.currentTarget;
    try {
      const response=await fetch(editing?`/api/products/${editing.id}`:'/api/products',{method:editing?'PUT':'POST',body:new FormData(form)});
      if(!response.ok){const body=await response.json().catch(()=>({})) as {error?:string};throw Error(body.error||'Could not save product');}
      form.reset();setEditing(null);setPreview(null);setMessage(ar?'تم حفظ المنتج.':'Product saved.');await refresh();
    }catch(error){setMessage(error instanceof Error?error.message:'Could not save product');}finally{setLoading(false);}
  }
  async function remove(product:Product){
    if(!window.confirm(ar?`حذف «${product.name_ar}» من الكتالوج؟ يمكنك التراجع بعد الحذف.`:`Delete “${product.name_en}” from the catalog? You can undo this.`))return;
    setLoading(true);setMessage('');
    try {
      const response=await fetch(`/api/products/${product.id}`,{method:'DELETE'});if(!response.ok)throw Error();
      setLastDeleted(product);if(editing?.id===product.id)cancel();await refresh();
      setMessage(ar?'تم حذف المنتج من الكتالوج.':'Product removed from the catalog.');
    }catch{setMessage(ar?'تعذر حذف المنتج.':'Could not delete product.');}finally{setLoading(false);}
  }
  async function undo(){
    if(!lastDeleted)return;setLoading(true);
    try{const response=await fetch(`/api/products/${lastDeleted.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({restore:true})});if(!response.ok)throw Error();setLastDeleted(null);setMessage(ar?'تمت استعادة المنتج.':'Product restored.');await refresh();}
    catch{setMessage(ar?'تعذر استعادة المنتج.':'Could not restore product.');}finally{setLoading(false);}
  }
  return <div dir={ar?'rtl':'ltr'}>
    <AdminHeader ar={ar} passwordLogin={passwordLogin} page="products" onToggle={()=>setLang(ar?'en':'ar')}/>
    <main className="shell admin-main">
      <div className="section-head"><div><h1 style={{fontSize:36,margin:0}}>{ar?'لوحة الإدارة':'Admin dashboard'}</h1><p>{ar?'إضافة المنتجات وتعديل الكتالوج':'Add products and manage your catalog'}</p></div></div>
      {message&&<p role="status" className="notice">{message}</p>}
      {lastDeleted&&<div className="notice undo-row"><span>{ar?`تمت إزالة: ${lastDeleted.name_ar}`:`Removed: ${lastDeleted.name_en}`}</span><button type="button" disabled={loading} onClick={undo}>{ar?'تراجع عن الحذف':'Undo delete'}</button></div>}
      <div className="admin-product-layout">
        <section className="admin-panel" id="product-editor"><h2>{editing?(ar?'تعديل المنتج':'Edit product'):(ar?'إضافة منتج':'Add product')}</h2>
          <form ref={formRef} key={editing?.id??'new'} className="form-grid" onSubmit={submit}>
            <label className="field">{ar?'العلامة':'Brand'}<select name="brand" defaultValue={editing?.brand||'Toyota'} required><option>Toyota</option><option>Nissan</option></select></label>
            <label className="field">{ar?'رقم القطعة':'Reference'}<Input name="reference" defaultValue={editing?.reference||''} maxLength={100}/></label>
            <label className="field">English name *<Input name="nameEn" defaultValue={editing?.name_en||''} required maxLength={120}/></label>
            <label className="field">الاسم بالعربية *<Input name="nameAr" defaultValue={editing?.name_ar||''} required maxLength={120}/></label>
            <label className="field">{ar?'الموديل':'Model'}<Input name="model" defaultValue={editing?.model||''} maxLength={100}/></label>
            <label className="field">{ar?'سنوات التوافق':'Compatible years'}<Input name="years" defaultValue={editing?.years||''} placeholder="2018–2024" maxLength={80}/></label>
            <label className="field">{ar?'السعر بالدينار الجزائري DZD (اختياري)':'Price in DZD (optional)'}<Input name="price" type="number" min="0" max="999999999999" step="0.01" inputMode="decimal" defaultValue={editing?.price||''}/></label>
            <label className="field">{ar?'نوع القطعة *':'Part type *'}<select name="partType" required defaultValue={editing?.part_type||''}><option value="" disabled>{ar?'اختر النوع':'Select type'}</option><option value="original">{ar?'أصلي':'Original'}</option><option value="commercial">{ar?'تجاري':'Commercial'}</option></select></label>
            <label className="field span2">{ar?'السيارات المتوافقة (اختياري)':'Car compatibility (optional)'}<Textarea name="compatibility" defaultValue={editing?.compatibility||''} maxLength={2000} rows={3} placeholder={ar?'مثال: Toyota Hilux Revo 2016–2024، محرك 2.4 ديزل\nأضف كل سيارة متوافقة في سطر.':'e.g. Toyota Hilux Revo 2016–2024, 2.4 diesel\nAdd each compatible vehicle on a new line.'}/><span className="muted field-hint">{ar?'أدخل الموديل، السنوات والمحرك أو رقم الهيكل المناسب.':'Enter models, years and relevant engine or chassis details.'}</span></label>
            <label className="field span2">{ar?'بلد الصنع':'Country of manufacture'}<Input name="manufactureCountry" defaultValue={editing?.manufacture_country||''} placeholder={ar?'مثال: اليابان':'e.g. Japan'} maxLength={80}/></label>
            <label className="field span2">{ar?'الوصف بالإنجليزية':'English description'}<Textarea name="descriptionEn" defaultValue={editing?.description_en||''} maxLength={500}/></label>
            <label className="field span2">{ar?'الوصف بالعربية':'Arabic description'}<Textarea name="descriptionAr" defaultValue={editing?.description_ar||''} maxLength={500}/></label>
            <label className="field span2">{editing?(ar?'استبدال صورة المنتج (اختياري)':'Replace product image (optional)'):(ar?'صورة المنتج (اختياري)':'Product image (optional)')}<Input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];setPreview(file?URL.createObjectURL(file):null)}}/><span className="muted field-hint">{ar?'JPG أو PNG أو WebP، حتى 5 ميغابايت':'JPG, PNG or WebP · up to 5 MB'}</span></label>
            {(preview||editing?.image_key)&&<img className="upload-preview span2" src={preview||(editing?productImage(editing):'')} alt={ar?'معاينة صورة المنتج':'Product image preview'}/>}
            {editing?.image_key&&<label className="checkbox-row span2"><input type="checkbox" name="removeImage"/>{ar?'إزالة الصورة الحالية':'Remove current image'}</label>}
            <Button type="submit" className="span2" disabled={loading}>{loading?'...':editing?(ar?'حفظ التعديلات':'Save changes'):(ar?'إضافة المنتج':'Add product')}</Button>
            {editing&&<button type="button" className="secondary-button span2" disabled={loading} onClick={cancel}>{ar?'إلغاء التعديل':'Cancel editing'}</button>}
          </form>
        </section>

      </div>
      <section className="admin-panel" style={{marginTop:24}}><h2>{ar?'المنتجات المنشورة':'Published products'} ({products.length})</h2><div className="records">{products.length===0?<p className="muted">{ar?'أضف أول منتج أعلاه.':'Add your first product above.'}</p>:products.map(product=><div className="record product-record" key={product.id}>{product.image_key&&<img src={productImage(product)} alt={ar?product.name_ar:product.name_en}/>}<div className="product-record-copy"><strong>{product.brand} · {ar?product.name_ar:product.name_en}</strong><div className="muted">{[product.reference,product.model,product.years].filter(Boolean).join(' · ')}</div><div style={{whiteSpace:'pre-line'}}>{product.compatibility}</div><div>{[formatPrice(product.price,ar),partTypeLabel(product.part_type,ar),product.manufacture_country].filter(Boolean).join(' · ')}</div></div><div className="product-actions"><button type="button" disabled={loading} onClick={()=>edit(product)}>{ar?'تعديل':'Edit'}</button><button type="button" className="delete-button" disabled={loading} onClick={()=>remove(product)}>{ar?'حذف':'Delete'}</button></div></div>)}</div></section>
    </main>
  </div>;
}
