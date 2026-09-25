/**
 * Kamus alias manual (bab 3.3, bab 8.1 B nomor 2).
 *
 * Daftar emiten resmi dari Sectors memberi nama perusahaan lengkap; ia tidak
 * tahu bahwa orang menulis "batu bara grup Thohir" atau "bank ijo". Alias di
 * bawah ini dikumpulkan B bersama D dari konten media sosial nyata dan
 * dimasukkan ke tabel `ticker_aliases` dengan `source = 'manual'`.
 *
 * `weight` menentukan pemenang bila dua alias cocok pada teks yang sama: alias
 * yang lebih panjang dan lebih spesifik diberi bobot lebih tinggi. Alias yang
 * ambigu sengaja diberi bobot rendah supaya UI meminta klarifikasi, bukan
 * menebak (bab 3.3 nomor 4).
 */

export type ManualAlias = { alias: string; ticker: string; weight: number };

export const MANUAL_ALIASES: ManualAlias[] = [
  // --- Perbankan
  { alias: 'bca', ticker: 'BBCA', weight: 1.0 },
  { alias: 'bank bca', ticker: 'BBCA', weight: 1.0 },
  { alias: 'bank central asia', ticker: 'BBCA', weight: 1.0 },
  { alias: 'bbca', ticker: 'BBCA', weight: 1.0 },
  { alias: 'bri', ticker: 'BBRI', weight: 1.0 },
  { alias: 'bank bri', ticker: 'BBRI', weight: 1.0 },
  { alias: 'bank rakyat indonesia', ticker: 'BBRI', weight: 1.0 },
  { alias: 'bbri', ticker: 'BBRI', weight: 1.0 },
  { alias: 'mandiri', ticker: 'BMRI', weight: 0.9 },
  { alias: 'bank mandiri', ticker: 'BMRI', weight: 1.0 },
  { alias: 'bmri', ticker: 'BMRI', weight: 1.0 },
  { alias: 'bni', ticker: 'BBNI', weight: 1.0 },
  { alias: 'bank bni', ticker: 'BBNI', weight: 1.0 },
  { alias: 'bank negara indonesia', ticker: 'BBNI', weight: 1.0 },
  { alias: 'btn', ticker: 'BBTN', weight: 1.0 },
  { alias: 'bank tabungan negara', ticker: 'BBTN', weight: 1.0 },
  { alias: 'bank jago', ticker: 'ARTO', weight: 1.0 },
  { alias: 'jago', ticker: 'ARTO', weight: 0.7 },
  { alias: 'bank neo', ticker: 'BBYB', weight: 1.0 },
  { alias: 'seabank', ticker: 'BBKP', weight: 0.9 },
  { alias: 'bank syariah indonesia', ticker: 'BRIS', weight: 1.0 },
  { alias: 'bsi', ticker: 'BRIS', weight: 0.9 },
  { alias: 'bank ijo', ticker: 'BBRI', weight: 0.6 },
  { alias: 'bank biru', ticker: 'BBCA', weight: 0.6 },
  { alias: 'bank kuning', ticker: 'BMRI', weight: 0.6 },
  { alias: 'bank oranye', ticker: 'BBNI', weight: 0.6 },
  { alias: 'big four bank', ticker: 'BBCA', weight: 0.3 },

  // --- Batu bara dan energi
  { alias: 'adaro', ticker: 'ADRO', weight: 1.0 },
  { alias: 'adro', ticker: 'ADRO', weight: 1.0 },
  { alias: 'adaro energy', ticker: 'ADRO', weight: 1.0 },
  { alias: 'batu bara grup thohir', ticker: 'ADRO', weight: 0.8 },
  { alias: 'batubara thohir', ticker: 'ADRO', weight: 0.8 },
  { alias: 'bukit asam', ticker: 'PTBA', weight: 1.0 },
  { alias: 'ptba', ticker: 'PTBA', weight: 1.0 },
  { alias: 'batu bara bumn', ticker: 'PTBA', weight: 0.7 },
  { alias: 'itmg', ticker: 'ITMG', weight: 1.0 },
  { alias: 'indo tambangraya', ticker: 'ITMG', weight: 1.0 },
  { alias: 'bumi resources', ticker: 'BUMI', weight: 1.0 },
  { alias: 'bumi', ticker: 'BUMI', weight: 0.7 },
  { alias: 'saham sejuta umat', ticker: 'BUMI', weight: 0.5 },
  { alias: 'harum energy', ticker: 'HRUM', weight: 1.0 },
  { alias: 'adaro andalan', ticker: 'AADI', weight: 1.0 },
  { alias: 'aadi', ticker: 'AADI', weight: 1.0 },

  // --- Tambang logam
  { alias: 'antam', ticker: 'ANTM', weight: 1.0 },
  { alias: 'aneka tambang', ticker: 'ANTM', weight: 1.0 },
  { alias: 'saham emas', ticker: 'ANTM', weight: 0.5 },
  { alias: 'inco', ticker: 'INCO', weight: 1.0 },
  { alias: 'vale indonesia', ticker: 'INCO', weight: 1.0 },
  { alias: 'timah', ticker: 'TINS', weight: 0.9 },
  { alias: 'merdeka copper', ticker: 'MDKA', weight: 1.0 },
  { alias: 'mdka', ticker: 'MDKA', weight: 1.0 },
  { alias: 'amman mineral', ticker: 'AMMN', weight: 1.0 },
  { alias: 'amman', ticker: 'AMMN', weight: 0.9 },

  // --- Teknologi
  { alias: 'gojek', ticker: 'GOTO', weight: 0.9 },
  { alias: 'gotog', ticker: 'GOTO', weight: 0.8 },
  { alias: 'gojek tokopedia', ticker: 'GOTO', weight: 1.0 },
  { alias: 'goto gojek', ticker: 'GOTO', weight: 1.0 },
  { alias: 'tokopedia', ticker: 'GOTO', weight: 0.8 },
  { alias: 'bukalapak', ticker: 'BUKA', weight: 1.0 },
  { alias: 'buka', ticker: 'BUKA', weight: 0.6 },
  { alias: 'blibli', ticker: 'BELI', weight: 1.0 },
  { alias: 'dcii', ticker: 'DCII', weight: 1.0 },
  { alias: 'data center indonesia', ticker: 'DCII', weight: 0.9 },
  { alias: 'multipolar teknologi', ticker: 'MLPT', weight: 1.0 },

  // --- Telekomunikasi dan infrastruktur
  { alias: 'telkom', ticker: 'TLKM', weight: 1.0 },
  { alias: 'telkom indonesia', ticker: 'TLKM', weight: 1.0 },
  { alias: 'tlkm', ticker: 'TLKM', weight: 1.0 },
  { alias: 'indosat', ticker: 'ISAT', weight: 1.0 },
  { alias: 'im3', ticker: 'ISAT', weight: 0.8 },
  { alias: 'xl axiata', ticker: 'EXCL', weight: 1.0 },
  { alias: 'xlsmart', ticker: 'EXCL', weight: 0.9 },
  { alias: 'tower bersama', ticker: 'TBIG', weight: 1.0 },
  { alias: 'mitratel', ticker: 'MTEL', weight: 1.0 },
  { alias: 'jasa marga', ticker: 'JSMR', weight: 1.0 },

  // --- Barito dan grup Prajogo
  { alias: 'barito renewables', ticker: 'BREN', weight: 1.0 },
  { alias: 'bren', ticker: 'BREN', weight: 1.0 },
  { alias: 'saham prajogo', ticker: 'BREN', weight: 0.6 },
  { alias: 'grup prajogo', ticker: 'BREN', weight: 0.6 },
  { alias: 'barito pacific', ticker: 'BRPT', weight: 1.0 },
  { alias: 'chandra asri', ticker: 'TPIA', weight: 1.0 },
  { alias: 'tpia', ticker: 'TPIA', weight: 1.0 },
  { alias: 'petrindo', ticker: 'CUAN', weight: 1.0 },
  { alias: 'cuan', ticker: 'CUAN', weight: 0.8 },

  // --- Konsumer
  { alias: 'indofood', ticker: 'INDF', weight: 0.9 },
  { alias: 'indofood cbp', ticker: 'ICBP', weight: 1.0 },
  { alias: 'icbp', ticker: 'ICBP', weight: 1.0 },
  { alias: 'indomie', ticker: 'ICBP', weight: 0.8 },
  { alias: 'unilever', ticker: 'UNVR', weight: 1.0 },
  { alias: 'unvr', ticker: 'UNVR', weight: 1.0 },
  { alias: 'mayora', ticker: 'MYOR', weight: 1.0 },
  { alias: 'kalbe', ticker: 'KLBF', weight: 1.0 },
  { alias: 'kalbe farma', ticker: 'KLBF', weight: 1.0 },
  { alias: 'sido muncul', ticker: 'SIDO', weight: 1.0 },
  { alias: 'gudang garam', ticker: 'GGRM', weight: 1.0 },
  { alias: 'sampoerna', ticker: 'HMSP', weight: 1.0 },
  { alias: 'hm sampoerna', ticker: 'HMSP', weight: 1.0 },
  { alias: 'amrt', ticker: 'AMRT', weight: 1.0 },
  { alias: 'alfamart', ticker: 'AMRT', weight: 1.0 },
  { alias: 'indomaret', ticker: 'DNET', weight: 0.6 },
  { alias: 'cleo', ticker: 'CLEO', weight: 1.0 },

  // --- Otomotif, properti, lain-lain
  { alias: 'astra', ticker: 'ASII', weight: 0.9 },
  { alias: 'astra international', ticker: 'ASII', weight: 1.0 },
  { alias: 'asii', ticker: 'ASII', weight: 1.0 },
  { alias: 'united tractors', ticker: 'UNTR', weight: 1.0 },
  { alias: 'untr', ticker: 'UNTR', weight: 1.0 },
  { alias: 'pakuwon', ticker: 'PWON', weight: 1.0 },
  { alias: 'bsd', ticker: 'BSDE', weight: 0.9 },
  { alias: 'bumi serpong damai', ticker: 'BSDE', weight: 1.0 },
  { alias: 'ciputra', ticker: 'CTRA', weight: 1.0 },
  { alias: 'semen indonesia', ticker: 'SMGR', weight: 1.0 },
  { alias: 'semen gresik', ticker: 'SMGR', weight: 0.9 },
  { alias: 'charoen pokphand', ticker: 'CPIN', weight: 1.0 },
  { alias: 'japfa', ticker: 'JPFA', weight: 1.0 },
  { alias: 'garuda', ticker: 'GIAA', weight: 0.9 },
  { alias: 'garuda indonesia', ticker: 'GIAA', weight: 1.0 },
  { alias: 'pgn', ticker: 'PGAS', weight: 1.0 },
  { alias: 'perusahaan gas negara', ticker: 'PGAS', weight: 1.0 },
  { alias: 'medco', ticker: 'MEDC', weight: 1.0 },
  { alias: 'pertamina geothermal', ticker: 'PGEO', weight: 1.0 },
  { alias: 'raja', ticker: 'RAJA', weight: 0.7 },
  { alias: 'bank rakyat', ticker: 'BBRI', weight: 0.8 },
];
