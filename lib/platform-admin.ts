import { isAdmin,usesPasswordLogin } from '@/lib/admin-auth';
import { database } from '@/lib/storage';
export async function isPlatformAdmin(){return usesPasswordLogin()&&await isAdmin();}
export const defaultBrands=['Toyota','Nissan','Renault','Peugeot','Citroën','Dacia','Volkswagen','Audi','BMW','Mercedes-Benz','Ford','Fiat','Opel','Hyundai','Kia','Suzuki','Mitsubishi','Mazda','Honda','Isuzu','Chevrolet','Škoda','SEAT','Chery','Geely','Changan','BYD','Great Wall','JAC','DFSK'];
export type PlatformSettings={brands:string[];support_email:string};
export async function platformSettings():Promise<PlatformSettings>{const row=await database().prepare('SELECT value FROM form_settings WHERE id=?').bind('platform:settings').first<{value:string}>();return row?JSON.parse(row.value):{brands:defaultBrands,support_email:''};}
