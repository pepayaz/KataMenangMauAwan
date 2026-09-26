import '../styles/styles.css';
import '../styles/theme.css';
import '../styles/integration.css';
import PwaRegistration from '../components/pwa-registration';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Cek Dulu',
  manifest: '/manifest.webmanifest',
  description: 'Agen pemeriksa klaim saham di media sosial terhadap data resmi Sectors.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body><PwaRegistration />{children}</body>
    </html>
  );
}
