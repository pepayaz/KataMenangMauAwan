// Fixtures untuk presentasi UI; bukan hasil pemeriksaan data pasar langsung.
export const examples = [
  {
    id: "dividend",
    ticker: "ADRO",
    category: "Dividen",
    text: "Yield dividen ADRO 25% setahun. Tinggal duduk manis, cuan ngalir terus!",
    status: "Benar tapi menyesatkan",
    tone: "amber",
    title: "Angkanya punya cerita lain.",
    summary:
      "Rata-rata historis dapat terlihat tinggi karena satu pembayaran dividen luar biasa. Angka tersebut tidak menggambarkan pembayaran rutin yang akan diterima setiap tahun.",
    metrics: [
      { label: "Yield dalam klaim", value: "25%", width: 83 },
      { label: "Rata-rata 5 tahun", value: "25,5%", width: 85 },
      { label: "Yield 12 bulan terakhir", value: "5,6%", width: 19 },
    ],
    context: "Pembayaran luar biasa mendominasi rata-rata",
    detail:
      "Dalam skenario demo ini, pembayaran dividen khusus membuat rata-rata historis melambung. Bandingkan periode yang sama dan pisahkan pembayaran rutin dari pembayaran satu kali.",
    evidence: "Fixture dividen ADRO · ilustrasi dari dokumen proyek",
    number: "01",
  },
  {
    id: "valuation",
    ticker: "BBCA",
    category: "Valuasi",
    text: "PER BBCA cuma 3x. Valuasinya murah banget sekarang!",
    status: "Dibantah",
    tone: "red",
    title: "Klaim dan data belum sejalan.",
    summary:
      "Angka PER dalam klaim berbeda jauh dari angka pembanding pada fixture demo. Pernyataan “murah” sendiri merupakan penilaian, bukan fakta yang bisa diputuskan hanya dari satu rasio.",
    metrics: [
      { label: "PER dalam klaim", value: "3×", width: 10 },
      { label: "PER pembanding demo", value: "24×", width: 80 },
    ],
    context: "Satu rasio bukan keseluruhan cerita",
    detail:
      "Penilaian valuasi memerlukan periode laporan yang jelas, konteks sektor, serta kualitas laba. Rasio yang rendah tidak otomatis berarti saham layak dibeli.",
    evidence: "Fixture valuasi BBCA · angka sintetis untuk demonstrasi",
    number: "02",
  },
  {
    id: "price",
    ticker: "TLKM",
    category: "Harga",
    text: "Harga TLKM naik 10% dalam sebulan terakhir.",
    status: "Didukung",
    tone: "green",
    title: "Untuk contoh ini, angkanya cocok.",
    summary:
      "Perubahan harga pada fixture sesuai dengan klaim untuk jendela satu bulan yang sama. Kesesuaian data historis tidak menunjukkan arah harga berikutnya.",
    metrics: [
      { label: "Kenaikan dalam klaim", value: "10%", width: 66 },
      { label: "Perubahan pada fixture", value: "10%", width: 66 },
    ],
    context: "Pastikan jendela waktunya sama",
    detail:
      "Persentase perubahan bergantung pada tanggal awal dan akhir. Dalam skenario ini kedua tanggal sudah disamakan, dan tidak ada konteks tambahan yang mengubah hasil demo.",
    evidence: "Fixture harga TLKM · angka sintetis untuk demonstrasi",
    number: "03",
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
export const storageKey = "cek-dulu-frontend-history-v1";

export function readHistory(): HistoryItem[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(storageKey) || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is HistoryItem =>
        Boolean(
          item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.text === "string" &&
          typeof item.saved === "boolean" &&
          typeof item.createdAt === "string" &&
          Number.isFinite(Date.parse(item.createdAt)) &&
          ["dividend", "valuation", "price", "custom"].includes(item.demoId),
        ),
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}
