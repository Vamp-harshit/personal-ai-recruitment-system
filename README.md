# Personal AI Recruitment System

A public, privacy-edited snapshot of Harshit Kumar's recruitment project, prepared on 25 November 2026 for sharing with ChatGPT.

**This is an Airtable-based system and project archive. There is no standalone website. The complete unattended recruitment service is not operational yet.**

## Start here

- [Current assessment and status](recruitment/Recruitment_System_Status_2026-11-25.md)
- [Candidate profile and search policy](recruitment/candidate_profile.json)
- [CRM schema](recruitment/cloud_crm_schema.json)
- [Initial evaluated opportunities](recruitment/initial_opportunities.json)
- [Public export manifest](PUBLIC_EXPORT_MANIFEST.json)

## What was built

- A private Airtable CRM with Applications, Candidate Facts, Application History, Daily Reports and Discovery Intake.
- Eight interface pages covering the pipeline, board, follow-ups, history, reports, candidate documents, performance and salary analytics.
- Corrected master resume plus two tailored resumes and cover letters for REA Group and Zynkrow.
- Job-description snapshots, weighted matching, compensation uncertainty, deduplication rules and submission evidence requirements.
- Two TinyFish cloud search monitors with successful baselines.
- Three saved Airtable workflow drafts for discovery, material-content preparation and reporting.
- Local scripts, QA checks, platform reviews and configuration/readback audits.

## Actual campaign state

| Measure | Count |
|---|---:|
| Distinct evaluated job records | 14 |
| Screening rejections | 5 |
| Held pending checks | 8 |
| Ready for personal application | 1 |
| Tailored resumes and cover letters | 2 each |
| Confirmed applications | 0 |
| Confirmed interviews or offers | 0 |

The corrected master and two tailored PDFs exist in the private cloud CRM. These public PDF copies have contact details removed and different hashes; they are review copies, not the exact application files.

## Process and planned daily schedule

1. Discover public backend and applied-AI opportunities at 09:00 and 09:15 IST.
2. Keep AI-extracted leads **Unverified**, check original employer sources, deduplicate and evaluate requirements.
3. Screen skills, experience, compensation, location, notice and platform permissions.
4. Prepare truthful resume/cover-letter content at 14:00 IST; verify an actual PDF before applying.
5. Submit only through permitted routes with required approvals; record Applied only after confirmed receipt.
6. Produce an evidence-based report at 19:00 IST and track authorized follow-ups.

Weights: technical 30%, experience 20%, compensation 20%, growth 15%, flexibility 10%, reputation 5%.

**Current runtime:** monitors are configured with tested baselines; their next scheduled execution was not observed. Airtable workflows are valid drafts and OFF. Full-cycle/scheduled tests, independent source verification, future cloud PDF generation, permitted submission workflows and Gmail monitoring remain outstanding. Monitor results are not yet automatically connected to CRM intake.

## Current workflow definitions

Use these versions when reviewing the final design:

| Stage | Latest configuration | Latest verification |
|---|---|---|
| Discovery | [discovery_final_privacy_payload.json](recruitment/discovery_final_privacy_payload.json) | [readback](recruitment/discovery_final_privacy_readback.json), [audit](recruitment/discovery_final_privacy_audit.json) |
| Preparation | [native_preparation_safeguarded_payload.json](recruitment/native_preparation_safeguarded_payload.json) | [readback](recruitment/native_preparation_safeguarded_readback.json) |
| Reporting | [native_report_safeguarded_payload.json](recruitment/native_report_safeguarded_payload.json) | [readback](recruitment/native_report_safeguarded_readback.json) |

Earlier custom-script, fallback, full-discovery and unsafeguarded files are historical experiments. The custom-script route was denied upstream; later native script-free drafts were saved. Local checks for retired scripts do not prove the native cloud graphs work.

## Files and tools

- `resume/`: contact-redacted master PDF.
- `recruitment/tailored_resumes/`: redacted tailored PDFs, cover letters, requirement mappings and manifests.
- `recruitment/archive/`: contact-redacted original resume backup.
- `recruitment/platform_reviews/`: Talent500 terms/privacy reviews.
- `recruitment/tmp_pdf/tailor_resumes.py`: original tailoring/QA script; requires PyMuPDF, NumPy and the Georgia fonts.
- `previews/`: regenerated contact-redacted PDF previews.
- Other `recruitment/*.json`, `*.js`, `*.cjs` and `*.md`: schema, audits, scripts, job research and documentation.

## Public-copy privacy and reproducibility

Original local files are unchanged. Contact addresses, phone numbers, present-pay details, temporary attachment links and machine user paths were removed. Live Airtable IDs and monitor IDs were pseudonymized consistently.

**This archive is not a deployable backup of the private cloud service.** Cloud records/interfaces/schedules remain hosted in Airtable/TinyFish. Recreate their resources through connected accounts, then bind their real IDs and test before activation. Source files may contain `PROJECT_ROOT`/`USER_HOME` placeholders which need local configuration. Original checksum references describe the private originals; the export manifest records hashes of the public copies.

Temporary PNG caches were excluded; fresh redacted PDF previews are provided. No credentials are included.

## Application integrity

Preserve actual employers, titles, dates and prototype/design-and-test scope. Never infer production ownership from a listed skill. Undisclosed pay remains unknown even when a reputed-employer application exception is authorized. Talent500 prohibits automated access without express written platform consent, so the prepared REA application is for personal completion. No account, OTP, legal consent or application was submitted by the agent.

## Suggested prompt for ChatGPT

> Read the README and current status report, then review the latest workflow definitions listed above. Explain the current architecture and incomplete stages. Help finish the cloud workflow tests and integrations without fabricating experience, exposing private data or claiming applications/schedules are confirmed before verification.
