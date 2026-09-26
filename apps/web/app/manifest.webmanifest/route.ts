import { getServiceClient } from '@cek-dulu/sectors';
import { loadFlags } from '@/lib/flags';
export const dynamic = 'force-dynamic';
export async function GET(): Promise<Response> {
  const flags = await loadFlags(getServiceClient());
  return Response.json({ id: '/', name: 'Cek Dulu', short_name: 'Cek Dulu', lang: 'id', start_url: '/', scope: '/', display: 'standalone',
    background_color: '#080b14', theme_color: '#080b14', icons: [192,512].map(size => ({ src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })),
    ...(flags.share_target ? { share_target: { action: '/share', method: 'POST', enctype: 'multipart/form-data',
      params: { title: 'title', text: 'text', url: 'url', files: [{ name: 'image', accept: ['image/*'] }] } } } : {}),
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } });
}
