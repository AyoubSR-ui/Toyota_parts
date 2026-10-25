import { Storefront } from '@/components/storefront';
export default async function StorePage({params}:{params:Promise<{slug:string}>}){return <Storefront slug={(await params).slug}/>;}
