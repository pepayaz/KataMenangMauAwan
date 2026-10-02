import Landing from '../components/landing';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  if (view !== undefined) redirect(view === 'history' || view === 'saved' || view === 'guide' ? `/check?view=${view}` : '/check');
  return <Landing />;
}
