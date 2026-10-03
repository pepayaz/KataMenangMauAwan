import { adaptInputRequest, inputFailure } from '@/lib/input-adapter';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function POST(request: Request): Promise<Response> {
  try { return Response.json(await adaptInputRequest(request), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (cause) { return inputFailure(cause); }
}
