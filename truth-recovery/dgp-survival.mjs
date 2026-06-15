// dgp-survival.mjs — STANDALONE seeded known-truth 2-arm survival DGP.
//
// Generates true individual event/censor times from a KNOWN parametric model
// (exponential per arm, with a known hazard ratio), then produces exactly the
// SUMMARY inputs the Guyot algorithm consumes:
//   - digitized KM read-off coordinates {t, s} at fixed reporting times
//   - numbers-at-risk tables {t, n} at a (coarser) set of times
//
// The "truth" we will later check recovery against:
//   - true median survival per arm = ln(2) / lambda
//   - true number of events (administrative censoring at tMax)
//   - true log hazard ratio = ln(lambda_tx / lambda_ctrl)
//
// Deterministic: seeded xoshiro128**-style PRNG (no external deps).

function makeRng(seed) {
  // mulberry32 — small, fast, deterministic.
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Inverse-CDF sampling of an exponential with rate lambda.
function rexp(rng, lambda) {
  let u = rng();
  if (u <= 0) u = 1e-12;
  return -Math.log(u) / lambda;
}

/**
 * Simulate one arm.
 * @param {function} rng
 * @param {number} n          patients in arm
 * @param {number} lambda     event hazard (per month)
 * @param {number} cLambda    independent censoring hazard (per month); 0 = none
 * @param {number} tMax       administrative censoring time (months)
 * @returns {{times:number[], events:number[]}} true individual data
 */
function simArm(rng, n, lambda, cLambda, tMax) {
  const times = [], events = [];
  for (let i = 0; i < n; i++) {
    const tEvent = rexp(rng, lambda);
    const tCens = cLambda > 0 ? rexp(rng, cLambda) : Infinity;
    // administrative censoring at tMax
    let t = Math.min(tEvent, tCens, tMax);
    let e = (tEvent <= tCens && tEvent <= tMax) ? 1 : 0;
    times.push(t);
    events.push(e);
  }
  return { times, events };
}

// Kaplan-Meier estimate of S(t) at a requested grid of report times,
// computed from the TRUE individual data. This emulates a perfect
// digitization read-off of the published curve.
function kmAtTimes(times, events, reportTimes) {
  // build sorted event times with KM product-limit
  const idx = times.map((_, i) => i).sort((a, b) => times[a] - times[b]);
  const sortedT = idx.map(i => times[i]);
  const sortedE = idx.map(i => events[i]);
  const n = times.length;
  // step survival
  const stepT = [], stepS = [];
  let surv = 1.0;
  let atRisk = n;
  let i = 0;
  while (i < n) {
    const t = sortedT[i];
    // count events and total at this exact time
    let d = 0, tot = 0;
    let j = i;
    while (j < n && sortedT[j] === t) { tot++; if (sortedE[j] === 1) d++; j++; }
    if (d > 0) {
      surv *= (1 - d / atRisk);
      stepT.push(t); stepS.push(surv);
    }
    atRisk -= tot;
    i = j;
  }
  // read off survival at each report time (last step <= t)
  return reportTimes.map(rt => {
    let s = 1.0;
    for (let k = 0; k < stepT.length; k++) {
      if (stepT[k] <= rt) s = stepS[k]; else break;
    }
    return { t: rt, s: +s.toFixed(4) };
  });
}

function nAtRisk(times, atRiskTimes) {
  return atRiskTimes.map(rt => ({ t: rt, n: times.filter(t => t >= rt).length }));
}

/**
 * Full deterministic dataset.
 * @param {object} cfg {seed, nTx, nCtrl, lambdaCtrl, hr, cLambda, tMax, reportTimes, atRiskTimes}
 */
export function generate(cfg) {
  const {
    seed = 12345, nTx = 1000, nCtrl = 1000,
    lambdaCtrl = Math.log(2) / 20, hr = 0.7,
    cLambda = 0.005, tMax = 36,
    reportTimes = Array.from({ length: 13 }, (_, i) => i * 3), // 0..36 by 3
    atRiskTimes = [0, 6, 12, 18, 24, 30, 36],
  } = cfg || {};

  const lambdaTx = lambdaCtrl * hr;
  const rng = makeRng(seed);

  const tx = simArm(rng, nTx, lambdaTx, cLambda, tMax);
  const ctrl = simArm(rng, nCtrl, lambdaCtrl, cLambda, tMax);

  const txCoords = kmAtTimes(tx.times, tx.events, reportTimes);
  const ctrlCoords = kmAtTimes(ctrl.times, ctrl.events, reportTimes);
  const txAtRisk = nAtRisk(tx.times, atRiskTimes);
  const ctrlAtRisk = nAtRisk(ctrl.times, atRiskTimes);

  // TRUTH from the simulated individual data (Monte-Carlo truth, not the
  // theoretical asymptote — this is what the reconstruction is being asked
  // to recover from THIS realized sample).
  const eventsTx = tx.events.reduce((a, b) => a + b, 0);
  const eventsCtrl = ctrl.events.reduce((a, b) => a + b, 0);

  return {
    cfg: { seed, nTx, nCtrl, lambdaCtrl, lambdaTx, hr, cLambda, tMax, reportTimes, atRiskTimes },
    truth: {
      // theoretical medians (distribution)
      medianTxTheory: +(Math.log(2) / lambdaTx).toFixed(2),
      medianCtrlTheory: +(Math.log(2) / lambdaCtrl).toFixed(2),
      logHRtheory: +Math.log(hr).toFixed(4),
      eventsTx, eventsCtrl, eventsTotal: eventsTx + eventsCtrl,
    },
    // exact individual data, kept for computing the SAMPLE-truth log-rank HR
    raw: { tx, ctrl },
    // summary inputs the algorithm consumes
    inputs: {
      txCoords, ctrlCoords, txAtRisk, ctrlAtRisk,
      txN0: nTx, ctrlN0: nCtrl,
    },
  };
}
