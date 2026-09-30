import { getServiceClient } from '@cek-dulu/sectors';
import { loadFlags } from '@/lib/flags';
import { inputFailure } from '@/lib/input-adapter';
import { readSharedInput, shareHandoff } from '@/lib/share-input';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function POST(request: Request): Promise<Response> {
  if (!(await loadFlags(getServiceClient())).share_target) return Response.json({ error: 'Web Share Target belum aktif. Gunakan upload screenshot atau tempel teks.' }, { status: 403 });
  try { return shareHandoff(await readSharedInput(request)); }
  catch (cause) { return inputFailure(cause); }
}
export function GET(): Response { return new Response(null, { status: 303, headers: { Location: '/' } }); }
