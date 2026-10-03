// Kebijakan eksekusi AGENTS.md bagian 5; tidak dapat dinaikkan oleh output LLM.
export const MAX_HYPOTHESES_PER_CLAIM = 3;
export const MAX_HUNTER_CREDITS_PER_CLAIM = 8;
export const MAX_SELECTION_REASON_LENGTH = 240;
// Heuristik konteks, bukan definisi resmi atau rekomendasi investasi.
// Mayoritas besar dalam satu pembayaran layak diperiksa; tepat ambang tidak terpicu.
export const DIV_ONE_OFF_SHARE = 0.6;
// Satu pembayaran rutin tahunan tidak cukup membuktikan pembayaran khusus.
export const DIV_MIN_PAYMENTS_FOR_STRONG = 2;
export const DIV_REVIEW_YEARS = 5;
// Selisih setengah angka historis cukup besar untuk konteks, bukan fluktuasi kecil.
export const DIV_TTM_RELATIVE_GAP = 0.5;
// Sama dengan toleransi ±10% relatif verifier valuation/dividend.
export const ASSERTED_RELATIVE_TOLERANCE = 0.1;
// Arus kas negatif atau dividen melebihi seluruh arus kas memerlukan konteks.
export const CASH_PAYOUT_MAX = 1;
// Median minimal tiga emiten menghindari satu peer mendikte perbandingan.
export const PEER_MIN_COUNT = 3;
// PE sangat ekstrem dan lebih dari tiga kali median awal dikeluarkan, bukan dirata-rata.
export const PEER_MAX_PE = 200;
export const PEER_OUTLIER_MEDIAN_MULTIPLE = 3;
// Premium 25% relatif median dianggap material untuk klaim valuasi murah.
export const VAL_PEER_PREMIUM = 0.25;
export const VAL_HISTORY_PREMIUM = 0.25;
export const VAL_HISTORY_MIN_YEARS = 3;
// PEG negatif bukan sinyal pertumbuhan positif; nol tidak dihitung negatif.
export const PEG_NEGATIVE_BOUNDARY = 0;
// Jendela kalender pembanding; masing-masing panggilan tetap mengikuti batas B.
export const PRICE_HISTORY_DAYS = 180;
export const PRICE_COMPARISON_DAYS = 90;
export const PRICE_HISTORY_MIN_OBSERVATIONS = 10;
export const PRICE_WINDOW_MIN_OBSERVATIONS = 2;
// Awal di bawah separuh median sejarah disertai rebound >=20% adalah basis rendah.
export const PRICE_LOW_BASE_RATIO = 0.5;
export const PRICE_REBOUND_MIN = 0.2;
// Lima observasi berpasangan minimum; ambang omzet harian Rp1 miliar adalah heuristik demo.
export const LIQUIDITY_MIN_OBSERVATIONS = 5;
export const THIN_LIQUIDITY_IDR = 1_000_000_000;
// Perbedaan >=30 poin persentase antar-jendela material untuk interpretasi pergerakan.
export const PRICE_WINDOW_GAP = 0.3;
