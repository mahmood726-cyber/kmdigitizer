// engine.mjs — pure functions extracted VERBATIM from kmdigitizer.html (lines 241-375)
// Guyot et al. 2012 IPD reconstruction + log-rank HR. No edits to logic; only `export` appended.
function guyotReconstruct(coords, n0, atRisk, arm) {
  if (coords.length < 2 || n0 <= 0) return [];

  // Defensive copy to avoid mutating caller's array
  coords = [...coords];
  // Ensure starts at t=0, S=1
  if (coords[0].t > 0) coords.unshift({ t: 0, s: 1.0 });

  // Build at-risk lookup (interpolate if needed)
  const nRiskAt = {};
  if (atRisk && atRisk.length > 0) {
    for (const r of atRisk) nRiskAt[r.t] = r.n;
  }

  const ipd = [];
  let nAlive = n0;

  for (let j = 0; j < coords.length - 1; j++) {
    const t0 = coords[j].t;
    const t1 = coords[j + 1].t;
    const s0 = coords[j].s;
    const s1 = coords[j + 1].s;
    const dt = t1 - t0;

    if (dt <= 0 || s0 <= 0) continue;

    // Number at risk at start of interval
    let nj = nRiskAt[t0] ?? nAlive;
    nj = Math.max(1, Math.round(nj));

    // Conditional survival in this interval
    const condSurv = s0 > 0 ? s1 / s0 : 1;

    // Number of events: d_j = n_j * (1 - S(t1)/S(t0))
    const dj = Math.max(0, Math.round(nj * (1 - condSurv)));

    // Number censored: c_j = n_j - d_j - n_{j+1}
    const njNext = nRiskAt[t1] ?? Math.round(nj * condSurv);
    const cj = Math.max(0, nj - dj - njNext);

    // Generate event records at the interval endpoint
    for (let i = 0; i < dj; i++) {
      ipd.push({ time: t1, event: 1, arm });
    }

    // Generate censoring records uniformly distributed in the interval
    for (let i = 0; i < cj; i++) {
      const cTime = t0 + dt * (i + 1) / (cj + 1);
      ipd.push({ time: +cTime.toFixed(4), event: 0, arm });
    }

    nAlive = njNext;
  }

  return ipd;
}

/* ═══════════════════════════════════════════════════════════════
   LOG-RANK HR ESTIMATION
═══════════════════════════════════════════════════════════════ */

function computeLogRankHR(ipd1, ipd2) {
  // Combine and get unique event times
  const all = [...ipd1, ...ipd2];
  const eventTimes = [...new Set(all.filter(r => r.event === 1).map(r => r.time))].sort((a, b) => a - b);

  if (eventTimes.length === 0) return { hr: null, ci: null, p: null };

  let O1 = 0, E1 = 0, V = 0;

  for (const t of eventTimes) {
    // At risk in each arm just before time t
    const n1 = ipd1.filter(r => r.time >= t).length;
    const n2 = ipd2.filter(r => r.time >= t).length;
    const n = n1 + n2;
    if (n === 0) continue;

    // Events at time t (tolerance-based comparison to avoid float === trap)
    const eps = 1e-8;
    const d1 = ipd1.filter(r => Math.abs(r.time - t) < eps && r.event === 1).length;
    const d2 = ipd2.filter(r => Math.abs(r.time - t) < eps && r.event === 1).length;
    const d = d1 + d2;

    // Expected events in arm 1 under null
    const e1 = d * n1 / n;

    // Variance (hypergeometric)
    const v = d * (n - d) * n1 * n2 / (n * n * Math.max(1, n - 1));

    O1 += d1;
    E1 += e1;
    V += v;
  }

  if (V <= 0) return { hr: null, ci: null, p: null };

  const logHR = (O1 - E1) / V;
  const seLogHR = 1 / Math.sqrt(V);
  const hr = Math.exp(logHR);
  const zCrit = normalQuantile(0.975); // 1.96 for 95% CI; derived not hardcoded
  const ciLo = Math.exp(logHR - zCrit * seLogHR);
  const ciHi = Math.exp(logHR + zCrit * seLogHR);
  const z = logHR / seLogHR;

  // Two-sided p-value
  const pVal = 2 * (1 - normalCDF(Math.abs(z)));

  return { hr: +hr.toFixed(3), ci: [+ciLo.toFixed(3), +ciHi.toFixed(3)], p: +pVal.toFixed(4), logHR, seLogHR };
}

function normalQuantile(p) {
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity; if (p === 0.5) return 0;
  const pLow = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(pLow));
  let z = t - (2.515517 + 0.802853*t + 0.010328*t*t) / (1 + 1.432788*t + 0.189269*t*t + 0.001308*t*t*t);
  return p < 0.5 ? -z : z;
}

function normalCDF(x) {
  if (x > 8) return 1; if (x < -8) return 0;
  const a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911;
  const s=x<0?-1:1, ax=Math.abs(x)/Math.sqrt(2), t=1/(1+p*ax);
  return .5*(1+s*(1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-ax*ax)));
}

function medianSurvival(coords) {
  for (let i = 0; i < coords.length - 1; i++) {
    if (coords[i].s >= 0.5 && coords[i + 1].s < 0.5) {
      // Linear interpolation
      const frac = (coords[i].s - 0.5) / (coords[i].s - coords[i + 1].s);
      return +(coords[i].t + frac * (coords[i + 1].t - coords[i].t)).toFixed(1);
    }
  }
  return 'NR'; // Not reached
}

export { guyotReconstruct, computeLogRankHR, normalQuantile, normalCDF, medianSurvival };
