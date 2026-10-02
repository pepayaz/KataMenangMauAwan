// Static frontend fixtures only. No market API / backend integration in this package.
export const examples = [
  {
    id: "dividend",
    ticker: "ADRO",
    category: "DIVIDEND",
    text: "ADRO yield dividennya 25,5% setahun.",
    status: "Benar, tapi menyesatkan",
    shortStatus: "MISLEADING",
    tone: "amber",
    headline: "Angkanya benar. Konteksnya mengubah cerita.",
    summary:
      "Rata-rata historis memang tinggi, tetapi satu pembayaran luar biasa menarik angkanya jauh ke atas. Yield berjalan saat ini jauh lebih rendah.",
    claimed: "25,5%",
    verified: "5,56%",
    delta: "−19,94 pp",
    context: "One-off dividend mendominasi rata-rata historis.",
    detail:
      "Pembayaran khusus tidak mewakili pola pembayaran rutin. Karena itu angka 25,5% benar sebagai rata-rata historis, tetapi menyesatkan bila dibaca sebagai yield yang berulang setiap tahun.",
    evidenceCount: 4,
    duration: "12,4s",
    evidence: [
      { label: "Yield 5Y Avg", value: "25,50%", flag: "MATCH" },
      { label: "Yield TTM", value: "5,56%", flag: "GAP" },
      { label: "Special dividend 2024", value: "Rp1.358,18", flag: "OUTLIER" },
      { label: "Cash payout ratio", value: "−0,90", flag: "FLAG" },
    ],
    hypotheses: [
      { code: "DIV_ONE_OFF", status: "TRIGGERED" },
      { code: "DIV_TTM_GAP", status: "TRIGGERED" },
      { code: "DIV_SHARE_CHANGE", status: "CLEAR" },
    ],
    source: "SECTORS · COMPANY REPORT / DIVIDEND",
  },
  {
    id: "valuation",
    ticker: "BBCA",
    category: "VALUATION",
    text: "PER BBCA cuma 3x. Murah banget sekarang.",
    status: "Dibantah",
    shortStatus: "REFUTED",
    tone: "red",
    headline: "Angka dalam klaim tidak cocok dengan pembanding.",
    summary:
      "PER pada klaim berbeda jauh dari angka pembanding pada fixture. Label “murah” tetap merupakan interpretasi dan tidak diputuskan dari satu rasio saja.",
    claimed: "3×",
    verified: "24×",
    delta: "+21×",
    context: "Satu rasio tidak cukup untuk menyimpulkan valuasi.",
    detail:
      "Periode laporan, kualitas laba, dan konteks historis perlu dibaca bersama. Pemeriksaan hanya menilai kecocokan klaim angkanya.",
    evidenceCount: 3,
    duration: "9,8s",
    evidence: [
      { label: "PER dalam klaim", value: "3×", flag: "CLAIM" },
      { label: "PER pembanding", value: "24×", flag: "MISMATCH" },
      { label: "Difference", value: "21×", flag: "GAP" },
    ],
    hypotheses: [
      { code: "VAL_OWN_HISTORY", status: "CLEAR" },
      { code: "VAL_ONE_OFF_EARNINGS", status: "CHECKED" },
      { code: "VAL_PEER_GAP", status: "CHECKED" },
    ],
    source: "SECTORS · COMPANY REPORT / VALUATION",
  },
  {
    id: "price",
    ticker: "TLKM",
    category: "PRICE MOVE",
    text: "Harga TLKM naik 10% dalam sebulan terakhir.",
    status: "Didukung",
    shortStatus: "SUPPORTED",
    tone: "lime",
    headline: "Klaim dan data pembanding berada pada jendela yang sama.",
    summary:
      "Perubahan harga pada fixture sesuai dengan klaim untuk periode satu bulan yang sama. Hasil ini tidak memprediksi arah harga berikutnya.",
    claimed: "+10%",
    verified: "+10%",
    delta: "0,00 pp",
    context: "Jendela waktu sudah disejajarkan sebelum dibandingkan.",
    detail:
      "Persentase perubahan harga sangat bergantung pada tanggal awal dan akhir. Pada contoh ini keduanya konsisten.",
    evidenceCount: 2,
    duration: "8,1s",
    evidence: [
      { label: "Claim window", value: "30 hari", flag: "MATCH" },
      { label: "Price change", value: "+10,00%", flag: "MATCH" },
    ],
    hypotheses: [
      { code: "PRC_WINDOW", status: "CLEAR" },
      { code: "PRC_SPLIT", status: "CLEAR" },
      { code: "PRC_LOW_BASE", status: "CLEAR" },
    ],
    source: "SECTORS · DAILY PRICE",
  },
] as const;

export type DemoId = (typeof examples)[number]["id"];
export type HistoryItem = {
  id: string;
  demoId: DemoId | "custom";
  text: string;
  createdAt: string;
  saved: boolean;
};

export const storageKey = "cek-dulu-frontend-history-v2";

export function readHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is HistoryItem => {
      if (!item || typeof item !== "object") return false;
      const value = item as Partial<HistoryItem>;
      return Boolean(
        typeof value.id === "string" &&
          typeof value.text === "string" &&
          typeof value.createdAt === "string" &&
          typeof value.saved === "boolean" &&
          ["dividend", "valuation", "price", "custom"].includes(
            String(value.demoId),
          ),
      );
    });
  } catch {
    return [];
  }
}
