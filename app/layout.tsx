import type { Metadata } from 'next';
import './globals.css';
import { LocaleProvider } from '@/components/locale';
export const metadata: Metadata = { title:'Auto Part | متاجر قطع الغيار', description:'Auto Part — independent auto parts stores with their own catalogs, branding and inventory.', icons:{icon:'/favicon.svg'} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ar"><body><LocaleProvider>{children}</LocaleProvider></body></html> }
