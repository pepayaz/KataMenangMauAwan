import Workspace from '../../components/workspace';
import { isFixtureDemoEnabled } from '../../lib/fixture-demo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tentang · Cek Dulu', description: 'Cara Cek Dulu membaca klaim saham, memeriksa angka, dan menunjukkan konteks serta sumbernya.' };

export default function About() {
  return <Workspace fixtureDemo={isFixtureDemoEnabled()} initialPage="about" />;
}
