# Truth-Recovery Validation — kmdigitizer

**Engine:** `kmdigitizer.html` (single-file). Pure functions `guyotReconstruct`,
`computeLogRankHR`, `normalQuantile`, `normalCDF`, `medianSurvival` extracted
VERBATIM into `truth-recovery/engine.mjs` (logic unedited; only `export` appended).

**Question:** Does the repo's Guyot (2012) reconstruction recover the truth —
median survival, number of events, and the log hazard ratio + its CI coverage —
when fed digitized KM coordinates + at-risk tables generated from a KNOWN
parametric survival model?

## Method (known-truth DGP)

`dgp-survival.mjs` (standalone, seeded mulberry32) simulates true individual
event/censor times for two arms from exponential survival with a known HR:
control hazard ln(2)/20 (true median 20 mo), HR 0.70 (true median Tx 28.6 mo),
n=1500/arm, independent + administrative censoring at 36 mo. True theoretical
log-HR = -0.357. From the realized sample it produces exactly the inputs the
algorithm consumes: perfect KM read-off coordinates (3-month grid) and at-risk
tables. `harness.mjs` runs the repo's OWN guyotReconstruct -> pseudo-IPD ->
computeLogRankHR, comparing against the same estimator on the TRUE individual
data and the known truth. Coverage = fraction of reconstructed 95% HR-CIs (120
seeded replicates) containing the true log-HR.

## Results (measured)

| Quantity | Reconstructed | Truth | Error |
|---|---|---|---|
| Median, Tx | 28.9 mo | 29.10 mo | -0.20 mo |
| Median, Ctrl | 19.4 mo | 19.72 mo | -0.32 mo |
| Events, Tx | 817 | 808 | +1.1% |
| Events, Ctrl | 1015 | 1002 | +1.3% |
| log-HR | -0.161 (HR 0.85) | -0.355 (HR 0.70) | bias +0.194 |
| HR-CI coverage | 0.033 | nominal 0.95 | severe under-coverage |

Sanity: computeLogRankHR on TRUE individual data recovers theory log-HR almost
exactly (-0.355 vs -0.357) and matches an independent Mantel-Haenszel reference
to 4 dp on identical input. The HR estimator is correct. Median + event-count
recovery are excellent and grid-insensitive.

## Key finding (honest negative)

Reconstructed log-HR is materially attenuated toward the null (HR 0.85 vs 0.70
true); HR-CI covers the truth only ~3% of the time.

Root cause (diagnosed): guyotReconstruct places every event record at the
interval ENDPOINT t1. With a shared digitization grid, all 1810 distinct true
event times collapse onto just 12 tied time points shared across both arms. The
log-rank (O-E)/V is heavily attenuated by these cross-arm ties. Refining the grid
3 -> 0.5 mo does NOT help; the bias is structural to endpoint-placement + common
grid, not digitization coarseness. This is the gap Guyot's real algorithm closes
by distributing events across implied per-arm event times within each interval.
Median/event counts depend only on interval totals, so they are unaffected.

## Verdict

GENUINE METHODS ENGINE — VALIDATED WITH A MATERIAL, REPRODUCIBLE DEFECT.
- Curve-shape recovery (median, events): accurate (<1 mo / <2%). PASS
- HR estimator computeLogRankHR: mathematically correct (matches reference). PASS
- Reconstructed two-arm HR/CI: NOT trustworthy — endpoint ties attenuate log-HR
  ~0.19 and collapse CI coverage to 0.03. FAIL

The About text claims "hazard ratios within 1-3% of original" (Guyot 2012). That
holds for the published algorithm, NOT this endpoint-placement simplification.

## Recommendation

1. Do not use the reconstructed HR/CI for inference as-is; median/RMST/event
   counts are fine, the two-arm HR is biased toward the null.
2. Fix: spread the dj events across distinct implied event times within [t0,t1)
   (Guyot product-limit inversion using at-risk numbers) instead of stacking at
   t1. Re-run this harness; tests A6/A7 fail loudly until coverage nears nominal.
3. Interim honesty fix: scope the "1-3%" About claim to the published method and
   warn the current build's HR is approximate.

## Files
- engine.mjs — verbatim pure functions + export
- dgp-survival.mjs — seeded known-truth 2-arm exponential survival DGP
- harness.mjs — wires repo reconstruction; measures median/event/log-HR + coverage
- test.mjs — 7 assertions (all pass; A6/A7 lock the honest negative)
- REPORT.md — this file
