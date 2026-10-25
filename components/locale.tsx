'use client';
import { createContext,useContext,useEffect,useState } from 'react';
import { translations } from '@/lib/translations';
export type Locale='ar'|'en'|'fr';
const Context=createContext<{locale:Locale;setLocale:(locale:Locale)=>void}>({locale:'ar',setLocale:()=>{}});
export function LocaleProvider({children}:{children:React.ReactNode}){const [locale,setLanguage]=useState<Locale>('ar');useEffect(()=>{const saved=localStorage.getItem('auto-part-language');if(saved==='ar'||saved==='en'||saved==='fr')setLanguage(saved);},[]);useEffect(()=>{document.documentElement.lang=locale;},[locale]);function setLocale(value:Locale){setLanguage(value);localStorage.setItem('auto-part-language',value);}return <Context.Provider value={{locale,setLocale}}>{children}</Context.Provider>;}
export function useLocale(){const {locale,setLocale}=useContext(Context);return {locale,setLocale,t:(value:string)=>locale==='ar'?value:(translations[value.trim()]?.[locale]?value.replace(value.trim(),translations[value.trim()][locale]):value)};}
export function LanguagePicker(){const {locale,setLocale}=useLocale();return <select className="language-picker" aria-label="Language / Langue / اللغة" value={locale} onChange={event=>setLocale(event.target.value as Locale)}><option value="ar">العربية</option><option value="en">English</option><option value="fr">Français</option></select>;}
