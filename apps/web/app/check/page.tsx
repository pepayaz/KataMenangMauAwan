import App from '../../../../frontend/src/App';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Periksa klaim · Cek Dulu' };

export default async function CheckPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  const initialPage = view === 'history' || view === 'saved' || view === 'guide' ? view : 'check';
  return <App initialPage={initialPage === 'history' || initialPage === 'saved' ? initialPage : 'check'} />;
}
