import '../styles/theme.css';
import '../styles/styles.css';
import '../styles/integration.css';
import PwaRegistration from '../components/pwa-registration';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';

const displayFont = localFont({ src: '../public/fonts/oxanium.ttf', variable: '--font-display-loaded', weight: '400 700', display: 'swap' });
const uiFont = localFont({ src: '../public/fonts/manrope.ttf', variable: '--font-ui-loaded', weight: '400 800', display: 'swap' });
const dataFont = localFont({ src: '../public/fonts/ibm-plex-mono.ttf', variable: '--font-data-loaded', weight: '400', display: 'swap' });

export const metadata = {
  title: 'Cek Dulu',
  manifest: '/manifest.webmanifest',
  description: 'Agen pemeriksa klaim saham di media sosial terhadap data resmi Sectors.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${displayFont.variable} ${uiFont.variable} ${dataFont.variable}`}>
      <body><PwaRegistration />{children}</body>
    </html>
  );
}
