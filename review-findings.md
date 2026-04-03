# KMDigitizer Code Review Findings

**Date:** 2026-04-03
**Reviewer:** Code Audit (Claude)
**File:** kmdigitizer.html (587 lines)

## P0 (Critical — must fix before ship)

No P0 issues found. The file has:
- CSP meta tag (line 6)
- Skip-to-content link (line 64)
- `escapeHtml()` with full quote escaping (line 191-193)
- `csvSafe()` with proper formula injection protection (line 505)
- Blob URL revocation in both `exportIPD()` and `exportJSON()`
- Modal escape key listener properly cleaned up (line 578)
- Focus trap in modal dialog (line 571-575)

## P1 (Important — fix before submission)

### P1-1: Log-rank HR uses O(n*k) nested filtering per event time
**Location:** `computeLogRankHR()` (~line 302-348)
**Issue:** For each unique event time, `ipd1.filter(r => r.time >= t)` scans the entire
array. With many patients and many event times, this is O(n*k) where n = patients and
k = unique event times. For the intended use case (hundreds of reconstructed patients),
this is fine, but could be slow for very large reconstructions.
**Recommendation:** Pre-sort and use index tracking for O(n + k) performance if needed.

### P1-2: Guyot algorithm assumes monotonically decreasing S(t)
**Location:** `guyotReconstruct()` (~line 240-295)
**Issue:** If user enters non-monotone survival coordinates (e.g., S increases at some
point due to digitization error), `condSurv = s1/s0 > 1` produces negative events
(`dj < 0`), which are clamped to 0. This silently drops the anomalous interval.
**Recommendation:** Add a validation step that warns the user about non-monotone
coordinates, or auto-correct by enforcing monotonicity.

### P1-3: Float === comparison correctly avoided
**Location:** Line 320
**Issue:** Uses `Math.abs(r.time - t) < eps` with `eps = 1e-8` -- correctly avoids
float equality. Good practice per lessons.md. No issue.

## P2 (Minor — nice to have)

### P2-1: External CDN dependency (Plotly)
**Location:** Line 8
**Issue:** Loads Plotly from CDN (`https://cdn.plot.ly/plotly-2.35.2.min.js`). If CDN
is unavailable, the KM plot will not render. For offline-first requirements, consider
bundling Plotly or providing a fallback SVG renderer.

### P2-2: No localStorage persistence
**Issue:** Unlike other tools, KMDigitizer does not save/load state from localStorage.
This is acceptable given the workflow (paste coordinates, reconstruct, export), but
could be added for convenience.

## Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| P0       | 0     | --    |
| P1       | 2     | No    |
| P2       | 2     | No    |
| **Total**| **4** |       |
