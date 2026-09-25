import { createClient } from '@supabase/supabase-js';

/**
 * Identitas pengguna untuk route handler (bab 8.2: "Akun dan riwayat — C (UI), B (API)").
 *
 * Cek boleh berjalan tanpa akun. Yang dibutuhkan akun hanyalah riwayat, jadi
 * fungsi ini tidak pernah menolak permintaan; ia hanya menjawab "siapa ini, kalau ada".
 */

export type AuthedUser = { id: string; email: string | null };

/** Mengambil token akses dari header Authorization atau cookie sesi Supabase. */
export function readAccessToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (header && /^bearer /i.test(header)) return header.slice(7).trim();

  const cookie = req.headers.get('cookie');
  if (!cookie) return null;
  // Supabase menulis cookie bernama sb-<ref>-auth-token berisi JSON [access, refresh].
  const match = /sb-[^=]*-auth-token=([^;]+)/.exec(cookie);
  if (!match || match[1] === undefined) return null;
  try {
    const decoded = decodeURIComponent(match[1]);
    const parsed: unknown = JSON.parse(decoded.replace(/^base64-/, ''));
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0];
    if (parsed && typeof parsed === 'object' && 'access_token' in parsed) {
      const token = (parsed as { access_token?: unknown }).access_token;
      return typeof token === 'string' ? token : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function getUser(req: Request): Promise<AuthedUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const token = readAccessToken(req);
  if (!token) return null;

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Penjaga dasbor internal /admin/credits. */
export function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  // Tanpa ADMIN_TOKEN, dasbor hanya terbuka di pengembangan lokal.
  if (!expected || expected === '') return process.env.NODE_ENV !== 'production';

  const header = req.headers.get('authorization');
  if (header && /^bearer /i.test(header) && header.slice(7).trim() === expected) return true;

  const url = new URL(req.url);
  return url.searchParams.get('token') === expected;
}
