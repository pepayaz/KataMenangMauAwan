# BBTN video transcript recheck — 8 October 2026

Branch: `fix/check-timeout-diagnostics`.
Source: https://www.tiktok.com/@olivia.louise04/video/7664241348140272917
Check: `88cc4b59-11df-461b-87eb-b69e51d62a55`.

The saved original transcript was submitted through `/api/check`. This does not measure video download or transcription again. The test ran against the development server, Supabase persistence, Gemini, and Sectors live mode with the exact source already cached. The replay took 8.214 seconds, accepted 8 claims, rejected 3 candidates, produced 6 evidence records, and spent 0 additional Sectors credits. An earlier live pull spent 6 credits for the matching six-quarter source. These are Sectors credits, not Gemini cost.

Two profit-growth claims (40% and 40.8%) are supported within the configured tolerance by H1 growth of 40.78%. Six others remain unverifiable with explicit reasons: nominal earnings is not a growth percentage, interest income/NIM/provision/loan portfolio need dedicated metrics, and historical PBV needs a matching dated source. Unsupported metrics are not substituted with total earnings or revenue.

H1 2026 earnings: Q1 1,107,979,000,000 + Q2 1,294,233,000,000 = 2,402,212,000,000 IDR.
H1 2025 earnings: Q1 903,710,000,000 + Q2 802,679,000,000 = 1,706,389,000,000 IDR.
The rounded growth matches the issuer announcement: https://www.btn.co.id/id/about/gallery/news/news/listing/2026/07/17/btn-cetak-kinerja-cemerlang-laba-bersih-semester-i-2026

The raw SSE replay is in `bbtn-final-recheck-2026-10-08.json`. Gemini extraction is stochastic, so accepted/rejected candidate counts can vary. Unique literal anchoring and semester normalization reduce avoidable rejection without accepting unwritten numbers. Explanations for unverifiable claims with no evidence bypass paid generation. No claim of a measured Gemini billing percentage reduction is made.
