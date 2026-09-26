import Workspace from '../components/workspace';
import { isFixtureDemoEnabled } from '../lib/fixture-demo';

export const dynamic = 'force-dynamic';
export default function Home() {
  return <Workspace fixtureDemo={isFixtureDemoEnabled()} />;
}
