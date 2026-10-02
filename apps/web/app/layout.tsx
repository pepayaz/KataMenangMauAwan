import '../styles/theme.css';
import '../styles/styles.css';
import '../styles/integration.css';
import '../styles/about.css';
import '../styles/expressive.css';
import '../styles/landing.css';
import PwaRegistration from '../components/pwa-registration';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';

const uiFont = localFont({ src: '../public/fonts/source-sans-3.ttf', variable: '--font-ui-loaded', weight: '200 900', display: 'swap' });

const displayFont = localFont({ src: '../public/fonts/barlow-semi-condensed-600.ttf', variable: '--font-display-loaded', weight: '600', display: 'swap' });

export const metadata = {
  title: 'Cek Dulu',
  manifest: '/manifest.webmanifest',
  description: 'Agen pemeriksa klaim saham di media sosial terhadap data resmi Sectors.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${uiFont.variable} ${displayFont.variable}`}>
      <body><PwaRegistration />{children}</body>
    </html>
  );
}
