'use client';
import { useState } from 'react';
import { catalogFieldOptions,parseCatalogFields,defaultCatalogFields } from '@/lib/catalog-fields';
import { useLocale } from '@/components/locale';
export function CatalogFieldEditor({initial}:{initial?:string|null}){const {t}=useLocale();const [fields,setFields]=useState(()=>parseCatalogFields(initial)||defaultCatalogFields());return <section className="span2 catalog-field-editor"><h3>{t('المعلومات الظاهرة للعميل في الكتالوج')}</h3><p>{t('اختر ما تريد نشره. اسم القطعة ظاهر دائماً. سعر الشراء خاص ولا يظهر للعملاء.')}</p><input type="hidden" name="catalogFields" value={JSON.stringify(fields)}/><div className="catalog-visibility-grid">{catalogFieldOptions.map(field=><label className="publish-control" key={field.key}><input type="checkbox" checked={fields[field.key]} onChange={event=>setFields(current=>({...current,[field.key]:event.target.checked}))}/>{t(field.label)}</label>)}</div></section>;}
