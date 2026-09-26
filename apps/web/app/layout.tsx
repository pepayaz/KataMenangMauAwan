import '../styles/styles.css';
import '../styles/theme.css';
import '../styles/integration.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Cek Dulu',
  description: 'Agen pemeriksa klaim saham di media sosial terhadap data resmi Sectors.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
