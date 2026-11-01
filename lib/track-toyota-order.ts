import { toyotaPixelId,type OrderTracking } from '@/lib/toyota-order-tracking';
type PixelWindow=Window&{fbq?:(...args:unknown[])=>void};
const sent=new Set<string>();
export function trackToyotaOrder(storeSlug:string|undefined,tracking:OrderTracking|undefined){
 if(storeSlug!=='toyota-parts'||!tracking||typeof window==='undefined'||!['Purchase','Lead'].includes(tracking.event)||!/^toyota-parts-(order|request)-[1-9]\d*$/.test(tracking.eventId))return;
 const fbq=(window as PixelWindow).fbq;if(typeof fbq!=='function')return;
 if(!tracking.data||typeof tracking.data!=='object')return;
 if(tracking.event==='Purchase'&&(tracking.data.currency!=='DZD'||typeof tracking.data.value!=='number'||!Number.isFinite(tracking.data.value)||tracking.data.value<0))return;
 const key='meta:'+toyotaPixelId+':'+tracking.eventId;
 if(sent.has(key))return;
 try{if(window.sessionStorage.getItem(key))return;}catch{}
 try{fbq('trackSingle',toyotaPixelId,tracking.event,tracking.data,{eventID:tracking.eventId});sent.add(key);try{window.sessionStorage.setItem(key,'1');}catch{}}catch{/* Analytics cannot prevent a successfully saved order. */}
}
