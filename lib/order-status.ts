export const orderStatuses=['new','confirmed','preparing','shipped','delivered','cancelled','returned'] as const;
export type OrderStatus=typeof orderStatuses[number];
export const orderStatusLabels:Record<OrderStatus,{ar:string;en:string;fr:string}>={
 new:{ar:'جديد',en:'New',fr:'Nouveau'},confirmed:{ar:'مؤكد',en:'Confirmed',fr:'Confirmé'},preparing:{ar:'قيد التحضير',en:'Preparing',fr:'En préparation'},shipped:{ar:'تم الشحن',en:'Shipped',fr:'Expédié'},delivered:{ar:'تم التسليم',en:'Delivered',fr:'Livré'},cancelled:{ar:'ملغى',en:'Cancelled',fr:'Annulé'},returned:{ar:'مرتجع',en:'Returned',fr:'Retourné'}
};
export function isOrderStatus(value:unknown):value is OrderStatus{return typeof value==='string'&&(orderStatuses as readonly string[]).includes(value);}
