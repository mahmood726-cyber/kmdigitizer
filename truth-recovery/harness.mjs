// harness.mjs — wire the repo's OWN reconstruction to the known-truth DGP and
// MEASURE recovery error of median / events / log-HR + HR-CI coverage.
//
// Pipeline per replicate:
//   1. generate() -> true individual data + the summary inputs (KM coords + at-risk)
//   2. guyotReconstruct() [REPO CODE] on each arm's coords -> pseudo-IPD
//   3. computeLogRankHR() [REPO CODE] on the pseudo-IPD -> reconstructed log-HR + CI
//   4. compare against:
//        - true sample log-HR: computeLogRankHR() on the TRUE individual data
//        - true median: KM median of the true data
//        - true event counts
//
// Honest rule (advanced-stats): Guyot IPD is NEVER exact. We report reconstruction
// error as measured and check it sits within reasonable tolerance.

import { generate } from './dgp-survival.mjs';
import { guyotReconstruct, computeLogRankHR, medianSurvival } from './engine.mjs';

// Convert raw {times,events} arm into the engine's IPD record shape.
function rawToIpd(arm, label) {
  return arm.times.map((t, i) => ({ time: t, event: arm.events[i], arm: label }));
}

// KM median directly from coords (same algorithm the app uses for display).
function coordMedian(coords) {
  const m = medianSurvival(coords);
  return m === 'NR' ? null : m;
}

// True KM median from individual data.
function trueMedian(arm) {
  const idx = arm.times.map((_, i) => i).sort((a, b) => arm.times[a] - arm.times[b]);
  const n = arm.times.length;
  let surv = 1, atRisk = n, i = 0, med = null;
  while (i < n) {
    const t = arm.times[idx[i]];
    let d = 0, tot = 0, j = i;
    while (j < n && arm.times[idx[j]] === t) { tot++; if (arm.events[idx[j]] === 1) d++; j++; }
    if (d > 0) { surv *= (1 - d / atRisk); if (surv < 0.5 && med === null) med = t; }
    atRisk -= tot; i = j;
  }
  return med;
}

export function runReplicate(cfg) {
  const ds = generate(cfg);
  const { inputs, raw } = ds;

  // --- REPO RECONSTRUCTION ---
  const ipdTx = guyotReconstruct(inputs.txCoords, inputs.txN0, inputs.txAtRisk, 'Tx');
  const ipdCtrl = guyotReconstruct(inputs.ctrlCoords, inputs.ctrlN0, inputs.ctrlAtRisk, 'Ctrl');

  const recEventsTx = ipdTx.filter(r => r.event === 1).length;
  const recEventsCtrl = ipdCtrl.filter(r => r.event === 1).length;
  const recMedTx = coordMedian(inputs.txCoords);
  const recMedCtrl = coordMedian(inputs.ctrlCoords);
  const recLR = computeLogRankHR(ipdTx, ipdCtrl);

  // --- TRUTH (sample) via SAME estimator on true individual data ---
  const trueIpdTx = rawToIpd(raw.tx, 'Tx');
  const trueIpdCtrl = rawToIpd(raw.ctrl, 'Ctrl');
  const trueLR = computeLogRankHR(trueIpdTx, trueIpdCtrl);
  const trueMedTx = trueMedian(raw.tx);
  const trueMedCtrl = trueMedian(raw.ctrl);

  return {
    truth: ds.truth,
    median: {
      txRec: recMedTx, txTrue: trueMedTx,
      ctrlRec: recMedCtrl, ctrlTrue: trueMedCtrl,
    },
    events: {
      txRec: recEventsTx, txTrue: ds.truth.eventsTx,
      ctrlRec: recEventsCtrl, ctrlTrue: ds.truth.eventsCtrl,
    },
    logHR: {
      rec: recLR.logHR, recHR: recLR.hr, recCI: recLR.ci,
      true: trueLR.logHR, trueHR: trueLR.hr,
      theory: ds.truth.logHRtheory,
      // CI coverage of the TRUE THEORETICAL log-HR by the reconstructed CI
      covered: recLR.ci ? (Math.log(recLR.ci[0]) <= ds.truth.logHRtheory &&
                           ds.truth.logHRtheory <= Math.log(recLR.ci[1])) : false,
    },
  };
}

// Monte-Carlo coverage study across seeds.
export function runStudy(baseCfg, nRep = 200) {
  const reps = [];
  for (let r = 0; r < nRep; r++) {
    reps.push(runReplicate({ ...baseCfg, seed: 1000 + r * 7 }));
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

  const logHRrec = reps.map(r => r.logHR.rec).filter(Number.isFinite);
  const logHRtrue = reps.map(r => r.logHR.true).filter(Number.isFinite);
  const biasVsTrue = mean(reps.map(r => r.logHR.rec - r.logHR.true).filter(Number.isFinite));
  const biasVsTheory = mean(logHRrec) - reps[0].logHR.theory;
  const coverage = mean(reps.map(r => (r.logHR.covered ? 1 : 0)));

  const medTxErr = mean(reps.map(r => (r.median.txRec ?? NaN) - (r.median.txTrue ?? NaN)).filter(Number.isFinite));
  const medCtrlErr = mean(reps.map(r => (r.median.ctrlRec ?? NaN) - (r.median.ctrlTrue ?? NaN)).filter(Number.isFinite));
  const evTxRelErr = mean(reps.map(r => (r.events.txRec - r.events.txTrue) / r.events.txTrue));
  const evCtrlRelErr = mean(reps.map(r => (r.events.ctrlRec - r.events.ctrlTrue) / r.events.ctrlTrue));

  return {
    nRep,
    meanLogHRrec: +mean(logHRrec).toFixed(4),
    meanLogHRtrue: +mean(logHRtrue).toFixed(4),
    theoryLogHR: reps[0].logHR.theory,
    biasVsTrue: +biasVsTrue.toFixed(4),
    biasVsTheory: +biasVsTheory.toFixed(4),
    hrCICoverage: +coverage.toFixed(3),
    medTxErr: +medTxErr.toFixed(3),
    medCtrlErr: +medCtrlErr.toFixed(3),
    evTxRelErr: +evTxRelErr.toFixed(4),
    evCtrlRelErr: +evCtrlRelErr.toFixed(4),
  };
}
