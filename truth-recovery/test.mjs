// test.mjs — truth-recovery assertions for kmdigitizer's Guyot reconstruction.
// Run: node truth-recovery/test.mjs   (exit 0 = all pass)
//
// These assertions encode the MEASURED behaviour of the repo's OWN code against
// a known-truth survival DGP. They are written to PASS on the current engine,
// documenting BOTH what it recovers well (median, event counts) and the honest
// negative (log-HR attenuation from coarse-grid event ties → CI under-coverage).

import { runReplicate, runStudy } from './harness.mjs';

let pass = 0, fail = 0;
function assert(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  [' + detail + ']' : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  [' + detail + ']' : '')); }
}

const cfg = { nTx: 1500, nCtrl: 1500, lambdaCtrl: Math.log(2) / 20, hr: 0.7, cLambda: 0.004, tMax: 36 };

// --- 1. MEDIAN recovery: pseudo-IPD median within 1 month of true median ---
const rep = runReplicate({ ...cfg, seed: 42 });
const medTxAbsErr = Math.abs(rep.median.txRec - rep.median.txTrue);
const medCtrlAbsErr = Math.abs(rep.median.ctrlRec - rep.median.ctrlTrue);
assert('A1 median(Tx) recovered within 1.0 mo', medTxAbsErr < 1.0,
  'rec ' + rep.median.txRec + ' vs true ' + rep.median.txTrue.toFixed(2));
assert('A2 median(Ctrl) recovered within 1.0 mo', medCtrlAbsErr < 1.0,
  'rec ' + rep.median.ctrlRec + ' vs true ' + rep.median.ctrlTrue.toFixed(2));

// --- 2. EVENT-COUNT recovery: within 3% relative ---
const evTxRel = Math.abs(rep.events.txRec - rep.events.txTrue) / rep.events.txTrue;
const evCtrlRel = Math.abs(rep.events.ctrlRec - rep.events.ctrlTrue) / rep.events.ctrlTrue;
assert('A3 events(Tx) recovered within 3%', evTxRel < 0.03,
  'rec ' + rep.events.txRec + ' vs true ' + rep.events.txTrue);
assert('A4 events(Ctrl) recovered within 3%', evCtrlRel < 0.03,
  'rec ' + rep.events.ctrlRec + ' vs true ' + rep.events.ctrlTrue);

// --- 3. log-rank ESTIMATOR is correct on true individual data ---
// (Recovers the known theoretical log-HR -0.357 closely when fed real IPD.)
const study = runStudy(cfg, 120);
assert('A5 log-rank on TRUE IPD recovers theory log-HR within 0.05',
  Math.abs(study.meanLogHRtrue - study.theoryLogHR) < 0.05,
  'true ' + study.meanLogHRtrue + ' vs theory ' + study.theoryLogHR);

// --- 4. HONEST NEGATIVE: reconstructed log-HR is materially attenuated ---
// Events pile onto the ~13 digitization-grid time points (ties), biasing the
// log-rank toward the null. We assert the bias is real and large (>0.1) so the
// test FAILS loudly if a future change silently "fixes" the number without a
// methodological correction (Guyot within-interval event spreading).
assert('A6 reconstructed log-HR is attenuated toward null (bias > 0.10, honest negative)',
  study.biasVsTrue > 0.10,
  'bias vs true = ' + study.biasVsTrue + ' (rec ' + study.meanLogHRrec + ' vs true ' + study.meanLogHRtrue + ')');

// --- 5. consequence: HR-CI coverage of the true log-HR is far below 0.95 ---
assert('A7 HR-CI under-covers true log-HR (coverage < 0.50, honest negative)',
  study.hrCICoverage < 0.50,
  'coverage = ' + study.hrCICoverage + ' (nominal 0.95)');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
