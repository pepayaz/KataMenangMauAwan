export type SectorsErrorCode =
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'NETWORK'
  | 'BUDGET_EXCEEDED'
  | 'CACHE_MISS'
  | 'REPLAY_MISS';

export class SectorsError extends Error {
  readonly code: SectorsErrorCode;
  readonly status: number | undefined;
  readonly endpoint: string | undefined;
  /** True bila memanggil ulang tidak akan menolong (404, 400). */
  readonly terminal: boolean;

  constructor(
    code: SectorsErrorCode,
    message: string,
    opts: { status?: number; endpoint?: string; terminal?: boolean } = {},
  ) {
    super(message);
    this.name = 'SectorsError';
    this.code = code;
    this.status = opts.status;
    this.endpoint = opts.endpoint;
    this.terminal = opts.terminal ?? (code === 'NOT_FOUND' || code === 'BAD_REQUEST');
  }
}

/**
 * Bab 6.1: kegagalan satu alat tidak boleh menjatuhkan seluruh cek. Verifier
 * memakai ini untuk memutuskan apakah klaim menjadi `unverifiable` atau
 * seluruh cek gagal.
 */
export function isMissingData(err: unknown): boolean {
  return (
    err instanceof SectorsError &&
    (err.code === 'NOT_FOUND' || err.code === 'CACHE_MISS' || err.code === 'REPLAY_MISS')
  );
}
