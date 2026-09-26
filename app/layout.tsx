import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Toyota Parts | قطع تويوتا ونيسان', description:'Request Toyota and Nissan spare parts for single purchases or wholesale.', icons:{icon:'/favicon.svg'} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html> }
