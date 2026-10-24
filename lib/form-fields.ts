export const requestFields = [
  {key:'name',en:'Full name',ar:'الاسم الكامل',required:true},
  {key:'phone',en:'WhatsApp number',ar:'رقم واتساب',required:true},
  {key:'brand',en:'Car brand',ar:'علامة السيارة',required:true},
  {key:'partName',en:'Part name',ar:'اسم القطعة',required:true},
  {key:'reference',en:'Part reference',ar:'الرقم المرجعي',required:false},
  {key:'model',en:'Car model',ar:'موديل السيارة',required:true},
  {key:'year',en:'Year',ar:'سنة الصنع',required:true},
  {key:'orderType',en:'Order type',ar:'نوع الطلب',required:true},
  {key:'quantity',en:'Quantity',ar:'العدد',required:false},
  {key:'vinFrame',en:'Search by VIN or frame number',ar:'أدخل رقم VIN أو رقم الهيكل',required:false},
  {key:'image',en:'Part photo',ar:'صورة القطعة',required:false},
  {key:'note',en:'Note',ar:'ملاحظة',required:false},
] as const;
export type FieldKey = typeof requestFields[number]['key'];
export type FormSettings = { fields: Record<FieldKey,{visible:boolean;required:boolean}> };
export function defaultFormSettings():FormSettings {return {fields:Object.fromEntries(requestFields.map(field=>[field.key,{visible:true,required:field.required}])) as FormSettings['fields']};}
export function parseFormSettings(value:unknown):FormSettings|null {
  if(!value||typeof value!=='object'||!('fields' in value)||!value.fields||typeof value.fields!=='object')return null;
  const fields=value.fields as Record<string,unknown>;
  if(Object.keys(fields).length!==requestFields.length)return null;
  const result=defaultFormSettings();
  for(const {key} of requestFields){const rule=fields[key];if(!rule||typeof rule!=='object'||!('visible' in rule)||!('required' in rule)||typeof rule.visible!=='boolean'||typeof rule.required!=='boolean')return null;result.fields[key]={visible:rule.visible,required:rule.visible&&rule.required};}
  return requestFields.some(({key})=>result.fields[key].visible)?result:null;
}
