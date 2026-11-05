import type {Metadata, Viewport} from 'next';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './globals.css';

export const metadata: Metadata = {
  title: {default: 'Muhasebe', template: '%s | Muhasebe'},
  description: 'Kişisel hesap, müşteri ve kart takibi. Personal accounts, clients and cards.',
  applicationName: 'Muhasebe',
  appleWebApp: {capable: true, statusBarStyle: 'black-translucent', title: 'Muhasebe'},
  icons: {icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png'},
  robots: {index: false, follow: false}
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0B0F17', colorScheme: 'dark'
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  // The localized layout owns html/body so language changes update the document.
  return children;
}
