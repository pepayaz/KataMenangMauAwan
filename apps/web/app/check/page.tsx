import Workspace from '../../components/workspace';
import { isFixtureDemoEnabled } from '../../lib/fixture-demo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Periksa klaim · Cek Dulu' };

export default async function CheckPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  const initialPage = view === 'history' || view === 'saved' || view === 'guide' ? view : 'check';
  return <Workspace fixtureDemo={isFixtureDemoEnabled()} initialPage={initialPage} />;
}
