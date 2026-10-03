/**
 * Bentuk respons Sectors yang dipakai Cek Dulu.
 *
 * Sengaja longgar: hanya field yang benar-benar dibaca verifier yang diberi
 * tipe, sisanya dibiarkan lewat. API menambah field tanpa memberi tahu, dan
 * cek yang gagal karena field baru adalah kegagalan yang tidak perlu.
 */

export type Nullable<T> = T | null;

export type HistoricalValuation = {
  year: number;
  pe: Nullable<number>;
  pb: Nullable<number>;
  ps: Nullable<number>;
  pcf: Nullable<number>;
  peg: Nullable<number>;
  pe_peer_avg: Nullable<number>;
  pb_peer_avg: Nullable<number>;
  ps_peer_avg: Nullable<number>;
};

export type ValuationSection = {
  last_close_price: Nullable<number>;
  latest_close_date: Nullable<string>;
  daily_close_change: Nullable<number>;
  forward_pe: Nullable<number>;
  intrinsic_value: Nullable<number>;
  historical_valuation: HistoricalValuation[];
};

export type DividendBreakdown = { date: string; total: number; yield: Nullable<number> };

export type DividendYear = {
  breakdown: DividendBreakdown[];
  total_yield: Nullable<number>;
  total_dividend: Nullable<number>;
};

export type DividendSection = {
  historical_dividends: Record<string, DividendYear>;
  upcoming_dividends: Nullable<unknown>;
  yield_ttm: Nullable<number>;
  dividend_yield_avg: Nullable<{ period: number; avg_yield: number }>;
  dividend_ttm: Nullable<number>;
  payout_ratio: Nullable<number>;
  cash_payout_ratio: Nullable<number>;
  last_ex_dividend_date: Nullable<string>;
};

export type OverviewSection = {
  listing_board: Nullable<string>;
  industry: Nullable<string>;
  sector: Nullable<string>;
  sub_sector: Nullable<string>;
  market_cap: Nullable<number>;
  market_cap_rank: Nullable<number>;
  listing_date: Nullable<string>;
  last_close_price: Nullable<number>;
  latest_close_date: Nullable<string>;
  daily_close_change: Nullable<number>;
  all_time_price: Nullable<Record<string, Record<string, number>>>;
  esg_score: Nullable<number>;
  tags: string[];
  indices: string[];
};

export type PeerItem = Record<string, unknown> & { symbol?: string; pe?: Nullable<number> };

export type FinancialsSection = {
  eps: Nullable<number>;
  historical_eps: Record<string, { eps: Nullable<number>; eps_growth: Nullable<number> }>;
  historical_financials: Array<Record<string, Nullable<number>> & { year: number }>;
};

export type OwnershipSection = Record<string, unknown> & {
  major_shareholders?: Array<{ name?: string; share_percentage?: Nullable<number> }>;
};

export type CompanyReport = {
  symbol: string;
  company_name: string;
  overview?: OverviewSection;
  valuation?: ValuationSection;
  dividend?: DividendSection;
  financials?: FinancialsSection;
  ownership?: OwnershipSection;
  peers?: PeerItem[];
  future?: Record<string, unknown>;
  management?: Record<string, unknown>;
};

export type DailyDataItem = {
  symbol: string;
  date: string;
  close: Nullable<number>;
  open?: Nullable<number>;
  high?: Nullable<number>;
  low?: Nullable<number>;
  volume: Nullable<number>;
  market_cap?: Nullable<number>;
};

export type ForeignFlowItem = {
  date: string;
  net_foreign_inflow: Nullable<number>;
  foreign_buy_idr: Nullable<number>;
  foreign_sell_idr: Nullable<number>;
  foreign_share: Nullable<number>;
};

export type ForeignFlowResponse = {
  symbol: string;
  start: string;
  end: string;
  data: ForeignFlowItem[];
};

export type QuarterlyFinancialItem = Record<string, unknown> & {
  symbol: string;
  date: string;
  revenue: Nullable<number>;
  earnings: Nullable<number>;
  operating_pnl?: Nullable<number>;
  non_operating_income_or_loss?: Nullable<number>;
  ebit?: Nullable<number>;
  ebitda?: Nullable<number>;
};

/** Kamus tahun -> daftar [tanggal laporan, label kuartal]. */
export type QuarterlyDates = Record<string, Array<[string, string]>>;

export type CorporateActions = {
  symbol: string;
  corporate_actions: {
    dividend: Nullable<Array<{
      ex_date: string;
      payment_date: Nullable<string>;
      dividend_yield: Nullable<number>;
      dividend_amount: Nullable<number>;
    }>>;
    upcoming_dividend: Nullable<unknown[]>;
    stock_split: Nullable<Array<{ date: string; split_ratio: Nullable<number> }>>;
    right_issue: Nullable<unknown[]>;
    warrant: Nullable<unknown[]>;
    bonus: Nullable<unknown[]>;
    agm: Nullable<unknown[]>;
  };
};

/**
 * Satu snapshot bulanan komposisi pemegang saham.
 *
 * Kategorinya banyak dan berakhiran `_l` (lokal) atau `_f` (asing), jadi
 * dibiarkan terbuka lewat index signature alih-alih ditulis satu per satu.
 * Nilainya boleh string karena `date` ikut di dalam objek yang sama; pembaca
 * wajib memeriksa `typeof` sebelum berhitung.
 */
export type ShareholderSnapshot = {
  date: string;
  shares_number: Nullable<number>;
  total_l: Nullable<number>;
  total_f: Nullable<number>;
} & { [category: string]: string | number | null | undefined };

export type ShareholdersComposition = {
  symbol: string;
  year: number;
  data: ShareholderSnapshot[];
};

export type FreeFloatItem = {
  symbol: string;
  company_name: string;
  free_float: Nullable<number>;
};

export type BrokerRow = {
  broker_code: string;
  bval: Nullable<number>;
  sval: Nullable<number>;
  nval: Nullable<number>;
  blot: Nullable<number>;
  slot: Nullable<number>;
  nlot: Nullable<number>;
};

export type BrokerSummaryResponse = {
  symbol: string;
  start: string;
  end: string;
  data: Array<{ date: string; summary: BrokerRow[] }>;
};

export type SuspensionItem = {
  symbol: string;
  suspension_date: string;
  reason: Nullable<string>;
  pdf_url: Nullable<string>;
};

export type Pagination = {
  total_count: number;
  showing: number;
  limit: number;
  offset: number;
  has_next: boolean;
  next_offset: Nullable<number>;
};

export type SuspensionsResponse = { results: SuspensionItem[]; pagination: Pagination };

export type ListingPerformance = {
  symbol: string;
  company_name: Nullable<string>;
  listing_date: Nullable<string>;
  chg_7d: Nullable<number>;
  chg_30d: Nullable<number>;
  chg_90d: Nullable<number>;
  chg_365d: Nullable<number>;
  offering_price: Nullable<number>;
};

export type CompanyListItem = { symbol: string; company_name: string } & Record<string, unknown>;

export type CompaniesResponse = { companies: CompanyListItem[]; pagination: Pagination };
