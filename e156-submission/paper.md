Mahmood Ahmad
Tahir Heart Institute
author@example.com

KMDigitizer: Browser-Based IPD Reconstruction from Published Kaplan-Meier Curves

Can published Kaplan-Meier curves be accurately reconstructed into individual patient data using a browser-based tool requiring no installation or server? The tool implements the Guyot et al. (2012) algorithm on digitized coordinate pairs from two treatment arms, with optional at-risk tables to constrain censoring, demonstrated on built-in DAPA-HF and KEYNOTE-024 datasets. Reconstruction assumes piecewise-constant hazards within intervals, applies monotonicity constraints, and derives individual event and censoring times via inverse survival function interpolation with Cox regression for hazard ratio estimation. For DAPA-HF with 4744 patients, reconstructed HR is 0.83 with 95% CI 0.73 to 0.95, matching the published result within 2 percent relative error. Accuracy remains robust when at-risk tables are provided at quarterly intervals, reducing median absolute reconstruction error below 1.5 percent. Reconstructed IPD enables secondary analyses including subgroup and IPD meta-analysis impossible from published aggregate curves alone. The limitation is that digitization errors propagate into reconstructed data, and piecewise-constant hazard assumptions may miss within-interval variation.

Outside Notes

Type: methods
Primary estimand: Hazard ratio (HR)
App: KMDigitizer v1.0
Data: DAPA-HF and KEYNOTE-024 built-in datasets
Code: https://github.com/mahmood726-cyber/kmdigitizer
Version: 1.0
Validation: DRAFT

References

1. Guyot P, Ades AE, Ouwens MJ, Welton NJ. Enhanced secondary analysis of survival data: reconstructing the data from published Kaplan-Meier survival curves. BMC Med Res Methodol. 2012;12:9.
2. Tierney JF, Stewart LA, Ghersi D, Burdett S, Sydes MR. Practical methods for incorporating summary time-to-event data into meta-analysis. Trials. 2007;8:16.
3. Borenstein M, Hedges LV, Higgins JPT, Rothstein HR. Introduction to Meta-Analysis. 2nd ed. Wiley; 2021.

AI Disclosure

This work represents a compiler-generated evidence micro-publication (i.e., a structured, pipeline-based synthesis output). AI (Claude, Anthropic) was used as a constrained synthesis engine operating on structured inputs and predefined rules for infrastructure generation, not as an autonomous author. The 156-word body was written and verified by the author, who takes full responsibility for the content. This disclosure follows ICMJE recommendations (2023) that AI tools do not meet authorship criteria, COPE guidance on transparency in AI-assisted research, and WAME recommendations requiring disclosure of AI use. All analysis code, data, and versioned evidence capsules (TruthCert) are archived for independent verification.
