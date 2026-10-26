import type { Metadata } from 'next';
import './globals.css';
import { PlatformFooter } from '@/components/platform-footer';
import { LocaleProvider } from '@/components/locale';
export const metadata: Metadata = { title:'Auto Part | متاجر قطع الغيار', description:'Auto Part — independent auto parts stores with their own catalogs, branding and inventory.', icons:{icon:'/auto-part-logo.svg'} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ar"><body><LocaleProvider>{children}<PlatformFooter/></LocaleProvider></body></html> }
