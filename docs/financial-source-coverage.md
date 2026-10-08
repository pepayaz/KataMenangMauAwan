# Financial source coverage

Numbers are extracted literally from reviewed content. TypeScript maps each supported financial metric to an explicit Sectors field, selects the report period, computes the comparison, applies a documented tolerance, and adjudicates the verdict. The LLM does not invent comparison numbers or determine the verdict.

## Sources and metric definitions

- Sectors quarterly financials: earnings (attributable to parent), revenue, operating_pnl, earnings_before_tax, gross_profit, ebit, ebitda, non_interest_income, provision.
- Bank fields: financials_sector_metrics.interest_income, net_interest_income, interest_expense, gross_loan, allowance_for_loans, total_deposit.
- Balance-sheet fields: total_assets and total_equity. These are end-of-period snapshots and are never summed over quarters.
- Company report valuation: requested annual PE/PB/PS/PCF/PEG from historical_valuation. A daily date is not substituted with an annual or latest ratio.

References: https://docs.sectors.app/api-references/v2/indonesia/report/quarterly-financials and https://docs.sectors.app/api-references/v2/indonesia/report/company-report . A mapped field can be null for a company or period; mapping a field does not guarantee availability for all IDX companies.

Standalone flow quarters are summed for a semester or year. Explicit cumulative metadata is preserved: H1 uses the cumulative June value; H2 subtracts cumulative June from December; an annual amount uses December. Standalone quarters are not confused with cumulative values. A claim without an explicit financial period uses the latest available quarter for a growth statement; nominal statements require a period. Labels inherited from a single-stock paragraph remain an interpretation of the reviewed transcript and must be reviewed by the user if the video discusses different periods.

Growth tolerance: 10% relative or 0.5 percentage points. Nominal tolerance: 1% relative for rounding. Zero/negative growth bases are reported as insufficient for an ordinary growth percentage. Partial current evidence is kept when the corresponding previous quarter is absent.

## What the report distinguishes

- source received from live Sectors versus exact Sectors cache;
- field null/missing versus quarter/report missing, including the field and date;
- cache miss versus a source 404 or access/budget/network failure;
- source granularity insufficient (annual PBV versus daily claim);
- unimplemented verifier versus confirmed absence in a queried source.

Coverage and sourceCalls live in verify trace data, which is persisted by the existing trace_events table. Both are visible in the report and survive reopening history; no new database column is required. A source already queried but lacking a field is not suggested as a pending paid re-pull of the same endpoint. The financial verifier is enabled by default in the web app; explicit environment/database flags can disable it. Other extended features remain opt-in.

## Confirmed limits

BBTN quarterly H1 data contains net_interest_income but total_earning_assets is null. An additional live financials-section audit found annual profitability.net_interest_margin for 2024 and 2025, with 2025 value 0.03563185582805318 (3.5631855828%). The annual financials/ratio source ends in 2025 and cannot verify H1 2026. The program now queries this source for annual NIM, ROA, ROE, CASA, CAR and margin claims. It refuses to substitute those annual ratios for a semester/quarter claim. No denominator is guessed. An acquisition amount for a specific pension-loan portfolio cannot be checked against the bank's gross total loans. A verifier/source for that transaction still needs development; this is not proof that all Sectors data lacks the information. The quantity of new customers likewise requires a compatible count metric/source. A current price or percentage move without its date/window cannot be fairly compared with a dated daily price series.

## Actual video test, 8 October 2026

Source: https://www.tiktok.com/@olivia.louise04/video/7664241348140272917
Check: 5246c8b0-d2ef-4aaa-a3bf-e871f9a5592d.
Video audio/frame read: 26.345 seconds. Check: 20.904 seconds. Accepted claims: 10. Evidence: 13. Verdicts: 3 supported, 2 refuted, 5 unverifiable. Sectors: 1 additional live credit for the valuation section; the already fetched six-quarter financial source was read from cache. This is not a Gemini cost figure. The raw test is docs/measurements/bbtn-source-coverage-2026-10-08.json.

With H1 as the report period: profit amount 2,402,212,000,000 IDR; profit growth 40.78%; gross interest-income growth -11.72%; provision-expense growth -57.93%. The claims -22% and -81% differ from those specific fields for that specific semester. This does not establish that the video's author was using the same period/definition; transcript corrections may change the comparison. A test suite on cached real values checks these computations without additional API calls.

The additional financials-source audit cost 1 Sectors credit and is recorded in docs/measurements/bbtn-financials-source-audit-2026-10-08.json. Ratio level tolerance is 0.1 percentage points; explicit relative ratio-growth claims use the growth tolerance.

Identical Sectors requests within a check are shared across concurrent claim verifiers. The original network credit is counted once; other claims reuse that exact response with zero extra credits. Failed requests are also shared for the duration of the check rather than repeated. Evidence retains the source params and fetchedAt.
