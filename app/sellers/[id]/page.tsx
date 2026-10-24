import { MarketSearch } from '@/components/market-search';
export default async function SellerPage({params}:{params:Promise<{id:string}>}){return <MarketSearch sellerId={(await params).id}/>;}
