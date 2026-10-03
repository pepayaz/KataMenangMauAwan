# eval — set uji dan evaluasi

**Pemilik: D** (bab 8.1 D, bab 11).

Isi yang diharapkan:

- `testset.jsonl` — 40 kasus berlabel. Setiap baris: teks asli (identitas pembuat
  disamarkan), ticker yang diharapkan, klaim dan tipenya, verdict yang
  diharapkan, hipotesis konteks yang diharapkan terpicu. Komposisi minimal
  5 kasus per tipe klaim dan 5 kasus jebakan.
- `run-eval.ts` — menjalankan pipeline di mode `cache_only` dan melaporkan
  metrik bab 11.2.
- `reports/` — hasil evaluasi yang di-commit sebagai bukti kedalaman teknis.

Cara menjalankan tanpa membakar kredit:

```bash
SECTORS_MODE=cache_only FLAG_CLAIM_TYPES_EXT=1 npx tsx eval/run-eval.ts
```

Di mode `cache_only`, panggilan yang belum ada di cache melempar `CACHE_MISS`
alih-alih menembak API. Panaskan cache lebih dulu dengan
`npx tsx scripts/pull-demo-data.ts --full --yes`.
