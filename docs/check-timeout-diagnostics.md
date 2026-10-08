# BBTN timeout diagnostics

The stored BBTN check from 8 October 2026 recognized BBTN (explicit, confidence 0.95), requested no ticker confirmation, then failed extraction with EXTRACTION_FAILED / TIMEOUT after approximately 60 seconds. No claims or Sectors verification were produced. The UI previously substituted an unverifiable report for a missing verdict, and its trace panel displayed static checks. Persistence marked the empty failed run done.

## Changes

- Classify missing verdicts using actual traces: failure, required ticker confirmation, or no extracted claims. Do not invent a verdict.
- Render actual stage messages, recognized tickers, extracted/rejected counts and rejection reasons. Unreached stages carry no success check.
- Preserve text and media source when returning to input or retrying a historical check. Restore ticker choices from its trace.
- Persist pre-verification errors as error, retaining the original SSE result contract and recorded diagnostics. Existing database rows are not rewritten; local history is interpreted from its traces.
- Set Gemini extraction reasoning to low for Gemini 3, or budget 1024 for Gemini 2.5 Flash. Keep literal quote/number/period validation, the 60-second timeout and no automatic timeout retry. Media transcription and feature flags are unchanged.

## Validation and limits

Offline regressions reproduce a BBTN extraction timeout and prove no Sectors network call occurs. Rendering tests cover timeout, ticker confirmation and rejected candidates. Provider tests assert the extraction reasoning configuration. Live extraction accuracy and latency still require measurement; reasoning limits reduce a source of variable latency but cannot guarantee provider availability or prevent all timeouts. No live Gemini/Sectors calls were made for this change. The earnings-growth flag remains off.
