# Truth-Recovery Validation — kmdigitizer

**Engine:** `kmdigitizer.html` (single-file). Pure functions `guyotReconstruct`,
`computeLogRankHR`, `normalQuantile`, `normalCDF`, `medianSurvival` are mirrored
into `truth-recovery/engine.mjs` and kept in lock-step with the HTML engine
(the truth-recovery fix below was applied identically to both).

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

## Results (measured) — BEFORE vs AFTER the fix

| Quantity | Before | After | Truth |
|---|---|---|---|
| Median, Tx | 28.9 mo | 28.9 mo | 29.10 mo |
| Median, Ctrl | 19.4 mo | 19.4 mo | 19.72 mo |
| Events, Tx | 817 | 817 | 808 |
| Events, Ctrl | 1015 | 1015 | 1002 |
| log-HR | -0.161 (HR 0.85) | -0.356 (HR 0.70) | -0.355 (HR 0.70) |
| bias vs true log-HR | +0.194 | **-0.0006** | 0 |
| HR-CI coverage | 0.033 | **0.975** | nominal 0.95 |

(120 seeded replicates, n=1500/arm, true HR 0.70.) Sanity: computeLogRankHR on
TRUE individual data recovers theory log-HR almost exactly (-0.355 vs -0.357).
The HR estimator was always correct; the defect was in reconstruction.

## Key finding — root cause corrected (the original "ties" diagnosis was WRONG)

The first pass blamed event ties on the shared digitization grid. Direct probing
disproved that: spreading the dj events across the interval (and every other
tie-breaking variant) made the bias WORSE (0.194 -> 0.21–0.29), not better.

The real defect: `guyotReconstruct` iterates intervals `j = 0 .. coords.length-2`
and emits events + within-interval censoring, but **never emits the patients
still at risk at the final coordinate**. For this DGP that is ~558/1500 = 37% of
each arm — administratively censored at tMax, simply dropped from the pseudo-IPD.
The reconstructed at-risk count at t=0 was 942 instead of 1500. A collapsed risk
set deflates the log-rank `n1/(n1+n2)` weights and attenuates (O-E)/V toward the
null. Median/event counts depend only on per-interval totals, so they were never
affected — which is exactly why the defect hid behind good median/event recovery.

## The fix

`guyotReconstruct` now (1) emits the `nAlive` survivors at the last coordinate as
administratively censored, and (2) spreads each interval's events over (t0, t1]
(Guyot 2012) rather than stacking at the endpoint. Component effect, measured:

- + trailing-censor emission alone: bias 0.194 -> -0.016, coverage 0.033 -> 0.942
- + event spread on top:            bias       -> -0.0006, coverage      -> 0.975

The trailing-censor omission was the dominant bug; the event spread is a smaller
genuine improvement. Applied identically to `kmdigitizer.html` and `engine.mjs`.

## Verdict

GENUINE METHODS ENGINE — DEFECT FOUND AND FIXED, CONFIRMED BY MEASUREMENT.
- Curve-shape recovery (median, events): accurate (<1 mo / <2%). PASS
- HR estimator computeLogRankHR: mathematically correct (matches reference). PASS
- Reconstructed two-arm HR/CI: now unbiased (|bias| 0.0006) with near-nominal
  CI coverage (0.975). FIXED — tests A6/A7 now assert recovery, not the defect.

The About text claim "hazard ratios within 1-3% of original" (Guyot 2012) now
holds for this build.

## Files
- engine.mjs — verbatim pure functions + export
- dgp-survival.mjs — seeded known-truth 2-arm exponential survival DGP
- harness.mjs — wires repo reconstruction; measures median/event/log-HR + coverage
- test.mjs — 7 assertions (all pass; A6/A7 lock the honest negative)
- REPORT.md — this file
