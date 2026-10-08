# BBTN timeout diagnostics

The stored BBTN check from 8 October 2026 recognized BBTN (explicit, confidence 0.95), requested no ticker confirmation, then failed extraction with EXTRACTION_FAILED / TIMEOUT after approximately 60 seconds. No claims or Sectors verification were produced. The UI previously substituted an unverifiable report for a missing verdict, and its trace panel displayed static checks. Persistence marked the empty failed run done.

## Changes

- Classify missing verdicts using actual traces: failure, required ticker confirmation, or no extracted claims. Do not invent a verdict.
- Render actual stage messages, recognized tickers, extracted/rejected counts and rejection reasons. Unreached stages carry no success check.
- Preserve text and media source when returning to input or retrying a historical check. Restore ticker choices from its trace.
- Persist pre-verification errors as error, retaining the original SSE result contract and recorded diagnostics. Existing database rows are not rewritten; local history is interpreted from its traces.
- Set Gemini extraction reasoning to low for Gemini 3, or budget 1024 for Gemini 2.5 Flash. Keep literal quote/number/period validation, the 60-second timeout and no automatic timeout retry. Media transcription and feature flags are unchanged.

## Initial validation and limits (before financial follow-up)

Offline regressions reproduce a BBTN extraction timeout and prove no Sectors network call occurs. Rendering tests cover timeout, ticker confirmation and rejected candidates. Provider tests assert the extraction reasoning configuration. Live extraction accuracy and latency still require measurement; reasoning limits reduce a source of variable latency but cannot guarantee provider availability or prevent all timeouts. The initial timeout-diagnostics commit made no live Gemini/Sectors calls and left the earnings-growth flag off. The financial follow-up below includes live validation and enables a dedicated local flag.

## Financial parsing follow-up

NIM ending levels are not signed as growth; sector-specific metrics are gated before any generic earnings lookup. A unique literal quote can repair an invalid provider offset, but repeated quotes with an invalid hint are rejected. Report periods carry within a single-stock paragraph only. Semester periods fetch enough quarters for both half-years and never compare H1 against Q2 alone. Quarterly comparisons select exact matching dates instead of positional array offsets.

The Sectors quarterly endpoint is normalized as standalone quarterly flow values (earnings/revenue); explicit cumulative metadata is preserved. This was reconciled for BBTN using the cached Q1 and Q2 2026 earnings (1,107,979,000,000 + 1,294,233,000,000 = 2,402,212,000,000) and the [issuer's H1 announcement](https://www.btn.co.id/id/about/gallery/news/news/listing/2026/07/17/btn-cetak-kinerja-cemerlang-laba-bersih-semester-i-2026). The analogous H1 2025 total is 1,706,389,000,000. This is a data-provider contract, not an inference repeated by the LLM. Mixed, incomplete or unrecognized explicit bases are refused.

An independent FLAG_EARNINGS_GROWTH enables this verifier without switching on all extended types. Local .env.local enables this flag; it remains ignored by Git. Other environments must set FLAG_EARNINGS_GROWTH=1 if desired. No-evidence unverifiable explanations use deterministic reason templates, avoiding paid generation for known blockers. Live replay initially used one extraction call and six Sectors credits. Nominal earnings, NIM verification and dated historical PBV remain outside current verifier coverage and are reported explicitly rather than being mapped to inappropriate data.


Final saved-transcript replay: check `88cc4b59-11df-461b-87eb-b69e51d62a55`, 8.214 seconds, 8 accepted claims, 3 rejected candidates, 6 evidence records, 2 supported growth claims, 6 unverifiable claims, 0 additional Sectors credits (the exact H1 source was already cached by the earlier live pull). The computed H1 profit growth is 40.78%, consistent with the 40.8% claim within tolerance. No video transcription was repeated. A preceding summary in a single-stock paragraph inherits its sole reporting period; equivalent semester notation is anchored back to the literal label. Multiple report labels do not authorize forward inheritance.
