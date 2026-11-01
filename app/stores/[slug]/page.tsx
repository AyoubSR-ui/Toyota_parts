import { Storefront } from '@/components/storefront';
import { ToyotaMetaPixel } from '@/components/toyota-meta-pixel';
export default async function StorePage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <>{slug==='toyota-parts'&&<ToyotaMetaPixel/>}<Storefront slug={slug}/></>;}
