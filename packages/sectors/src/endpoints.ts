/**
 * Katalog endpoint Sectors yang dipakai Cek Dulu, beserta kebijakan cache
 * (bab 6.2), biaya kredit (bab 6.3), dan batas jendela waktu (bab 4).
 *
 * Satu tempat untuk semua angka ini supaya estimasi kredit di router dan
 * penegakan anggaran di klien tidak pernah berbeda pendapat.
 */

export const HOUR = 3600;
export const DAY = 24 * HOUR;

/** TTL per jenis data — tabel bab 6.2. Nilai dalam detik. */
export const TTL = {
  /** Profil, overview, segmen — jarang berubah. */
  profile: 7 * DAY,
  /** Laporan kuartalan, dividen, aksi korporasi — berubah saat rilis. */
  filings: 24 * HOUR,
  /** Harga harian, arus asing, broker summary — cukup untuk demo. */
  market: 12 * HOUR,
  /** Komposisi pemegang saham — snapshot bulanan. */
  shareholders: 7 * DAY,
  /** Daftar emiten — sekali tarik, disimpan permanen di ticker_aliases. */
  permanent: 365 * DAY,
} as const;

export type EndpointName =
  | 'fetchCompanyReport'
  | 'fetchQuarterlyFinancials'
  | 'fetchQuarterlyFinancialDates'
  | 'fetchDailyPrice'
  | 'fetchForeignFlow'
  | 'fetchCorporateActions'
  | 'fetchShareholdersComposition'
  | 'fetchFreeFloat'
  | 'fetchBrokerSummary'
  | 'fetchSuspensions'
  | 'fetchListingPerformance'
  | 'fetchCompanies';

export type EndpointSpec = {
  /** Template path REST; `{symbol}` diganti simbol tanpa akhiran `.JK`. */
  path: string;
  ttlSeconds: number;
  /** Batas jendela per panggilan dalam hari; null bila endpoint tidak berbasis jendela. */
  maxWindowDays: number | null;
};

export const ENDPOINTS: Record<EndpointName, EndpointSpec> = {
  fetchCompanyReport: {
    path: '/v2/company/report/{symbol}/',
    ttlSeconds: TTL.profile,
    maxWindowDays: null,
  },
  fetchQuarterlyFinancials: {
    path: '/v2/financials/quarterly/{symbol}/',
    ttlSeconds: TTL.filings,
    maxWindowDays: null,
  },
  fetchQuarterlyFinancialDates: {
    path: '/v2/company/get_quarterly_financial_dates/{symbol}/',
    ttlSeconds: TTL.filings,
    maxWindowDays: null,
  },
  fetchDailyPrice: {
    path: '/v2/daily/{symbol}/',
    ttlSeconds: TTL.market,
    maxWindowDays: 90,
  },
  fetchForeignFlow: {
    path: '/v2/foreign-flow/{symbol}/',
    ttlSeconds: TTL.market,
    maxWindowDays: 90,
  },
  fetchCorporateActions: {
    path: '/v2/company/corporate-actions/{symbol}/',
    ttlSeconds: TTL.filings,
    maxWindowDays: null,
  },
  fetchShareholdersComposition: {
    path: '/v2/company/shareholders-composition/{symbol}/',
    ttlSeconds: TTL.shareholders,
    maxWindowDays: null,
  },
  fetchFreeFloat: {
    path: '/v2/free-float/',
    ttlSeconds: TTL.profile,
    maxWindowDays: null,
  },
  fetchBrokerSummary: {
    path: '/v2/broker-summary/{symbol}/',
    ttlSeconds: TTL.market,
    maxWindowDays: 14,
  },
  fetchSuspensions: {
    path: '/v2/suspensions/',
    ttlSeconds: TTL.filings,
    maxWindowDays: null,
  },
  fetchListingPerformance: {
    path: '/v2/listing-performance/{symbol}/',
    ttlSeconds: TTL.profile,
    maxWindowDays: null,
  },
  fetchCompanies: {
    path: '/v2/companies/',
    ttlSeconds: TTL.permanent,
    maxWindowDays: null,
  },
};

/** Semua section laporan perusahaan; masing-masing 1 kredit. */
export const REPORT_SECTIONS = [
  'overview',
  'valuation',
  'future',
  'peers',
  'financials',
  'dividend',
  'management',
  'ownership',
] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

/**
 * Biaya kredit satu panggilan. Nilai yang tidak bisa diketahui sebelum
 * respons datang (free-float per 100 perusahaan) diperkirakan konservatif —
 * lebih baik memesan kredit berlebih daripada melewati anggaran.
 */
export function estimateCredits(endpoint: EndpointName, params: Record<string, unknown>): number {
  switch (endpoint) {
    case 'fetchCompanyReport': {
      const sections = params.sections;
      if (Array.isArray(sections) && sections.length > 0) return sections.length;
      return REPORT_SECTIONS.length; // default semua section = 8 kredit
    }
    case 'fetchQuarterlyFinancials': {
      const n = Number(params.n_quarters ?? 1);
      return Number.isFinite(n) && n > 0 ? Math.ceil(n) : 1;
    }
    case 'fetchFreeFloat': {
      // 1 kredit per 100 perusahaan. Tanpa filter, IDX punya ~950 emiten.
      const filtered = ['sector', 'sub_sector', 'industry', 'sub_industry'].some(
        (k) => params[k] !== undefined && params[k] !== '',
      );
      return filtered ? 2 : 10;
    }
    case 'fetchCompanies': {
      const limit = Number(params.limit ?? 50);
      return params.q !== undefined && params.q !== '' ? 3 : Math.max(1, Math.ceil(limit / 1000));
    }
    default:
      return 1;
  }
}
