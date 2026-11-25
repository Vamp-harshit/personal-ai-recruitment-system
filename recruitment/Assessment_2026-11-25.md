# Harshit Kumar — recruitment assessment and proposed operating plan

Assessed: 25 November 2026. Timezone: Asia/Kolkata. This is Phase 1 and the proposed Phase 2 strategy, awaiting approval. It is not a running recruitment service or application tracker.

## Completed and verified

- Read all resume files in the resume folder: one one-page PDF.
- Corrected full name, visible email, mailto, and LinkedIn/GitHub links in the existing PDF. Removed conflicting foreign and duplicate hyperlinks. Original saved in recruitment/archive.
- Preserved the one-page design, Georgia font family/sizes, body wording and coordinates. Body render below the contact header had zero pixel difference. Reopened PDF and confirmed six unique active links.
- Local file access works. Public job search and live employer-page retrieval work for tested Lever and YC pages.
- Native Windows app inventory works; Firefox is present. Connected browser-tab control is unavailable for this chat. Job-platform login, upload and submission have not been tested.
- No applications or recruiter messages submitted. No tailored job resumes generated. No dashboard, scheduler or email connection configured.

## Candidate assessment

Resume claims support an early-career backend developer with applied LLM/RAG experience. Preserve the actual TCS designation; technical focus belongs in a summary, not an invented job title.

- TCS: System Engineer (AI Cloud), June 2025–present. Resume describes LangChain multi-agent prototypes, semantic caching, LangSmith tracing, Qdrant RAG designed/tested over 500+ technical documents, Scrapy ingestion and sitemap automation.
- WaahAds: Software Engineer, July 2024–May 2025. Resume describes Node.js/Express/PostgreSQL microservices and an OpenAI/LangChain content pipeline.
- Code-Collab: React/Node/Express/Socket.io project with external code-execution API and five supported languages.
- Education: B.Tech Computer Science, SIET Nilokheri, graduation 2024; 8.1 CGPA stated.
- DSA/competitive programming: 400+ problems, LeetCode 1799, CodeChef and Hash Code ranks stated. Current values/profile evidence not checked.
- No certifications listed.

If employment dates are accurate, approximate experience is 2 years 4 months overall and 1 year 5 months at TCS as of assessment date. Employment nature, dates, actual title, tasks, ownership and production scope remain unconfirmed. User cannot substantiate now and plans to learn before interviews. Future learning is not evidence of past work. Source wording was preserved at user's request; uncertain claims must be factually confirmed before used as verified submitted experience. Confirmation is sufficient; confidential employer documents are not required.

Main gaps: broad framework list without corresponding work examples; unclear prototype versus production scope; missing testing/CI/CD/operational ownership details. Validate 20–25% API reduction, both 40% claims, 750 concurrent users versus test capacity and the measurement behind 12% maintainability. Listed Spring Boot, FastAPI, Flask, LangGraph, HuggingFace, AWS, Docker, Redis, Playwright, Next.js and Tailwind are not automatically verified professional proficiency.

## Proposed seven role categories

1. Node.js backend engineer: strongest direct employment claim; Node/Express/PostgreSQL, REST and service design.
2. Python backend/API developer: relevant AI/scraping work; confirm FastAPI/Flask and testing depth.
3. Applied GenAI/LLM integration engineer: LangChain/OpenAI/Qdrant/RAG/tracing; target application engineering rather than model-training/research roles.
4. SDE I/associate software engineer: backend project and DSA foundation; target 1–3 years, job-specific requirements.
5. Backend-focused full-stack engineer: React project plus backend; frontend professional depth unconfirmed.
6. API integration/automation engineer: integrations, scraping and workflow automation; inspect that role offers engineering growth.
7. Python ingestion/junior ETL engineer: Python/SQL/Scrapy; avoid assuming Spark/Airflow/Kafka/warehouse experience.

DevOps/cloud and SDET are exploratory only until infrastructure, CI/CD or automated-test ownership is established. Do not infer test-engineering experience from Postman or software-design experience from a title.

## Confirmed search constraints

- Reported current annual pay: Rs [CURRENT_PAY_REDACTED] lakh; fixed/CTC breakdown unknown.
- 90 days notice. Possible reduction is not confirmed and must not be advertised as immediate availability.
- Current city: Kurukshetra. Remote eligible in India preferred, then hybrid/on-site in North India. Specify eligible cities before relocation offers.
- Other regions only when monthly pay exceeds Rs 1 lakh. Gross/in-hand basis needs clarification; conservatively interpret as take-home.
- Hard floor: Rs 40,000 take-home monthly; prefer at least Rs 50,000.
- No employment bond, per user.

Proposed core search/negotiation target: Rs 7–10 LPA fixed; selective stretch Rs 10–14 LPA fixed. These are judgment-based targets conditional on actual demonstrable work, not market averages or guaranteed outcomes. Rs 6 LPA fixed equals Rs 50,000 gross monthly and can miss the Rs 50,000 take-home preference after deductions. Treat CTC, fixed salary, monthly gross and estimated net as distinct values; exclude employer PF/gratuity, variable pay, equity and joining bonuses from monthly dependable salary. Obtain payroll breakdown before an offer is marked salary-qualified.

## Source-access and market tests

Public sources checked 25 November 2026. This was a capability/market sample, not a comprehensive initial campaign.

- Entrata official Lever Software Engineer (AI, Python & AWS): live full description and Apply link. 2+ years, Pune on-site, salary unknown. Strong backend/applied AI overlap; current location constraint excludes it unless compensation clears the relocation threshold. https://jobs.lever.co/entrata/fce2a8b4-042d-41ce-90ba-8363e182e897
- AiPrise SDE I on YC: live employer-authored description and Apply link; salary field Rs 1.5M–Rs 3M INR, fixed/CTC and period not explicit in retrieved text. Header Bangalore and 1+ years, body 0–2 years and inconsistent San Jose in-person wording. Hold pending location, experience and pay clarification. https://www.workatastartup.com/jobs/104681
- FurtherAI remote India: live YC page, 3+ years and at least four hours PST overlap plus intense-work wording. Experience/work-hours concerns; watchlist rather than core. https://www.workatastartup.com/jobs/68037
- Speedy Labs remote India: live YC page, 3+ years, Django/GraphQL/Celery gaps. Watchlist rather than core. https://www.workatastartup.com/jobs/83637
- LinkedIn RecruitBots AI result: search excerpt only; direct retrieval failed unsupported_site 403. Not verified or ready to apply. https://in.linkedin.com/jobs/view/genai-engineer-at-recruitbots-ai-4488685136

Firecrawl provider catalogue inspected: Indeed and employer ATS sources including Ashby, Greenhouse, Lever, Workday, Workable, SmartRecruiters and YC exist. Individual provider execution beyond tested sources remains untested. LinkedIn connector exposes people-profile lookup, not a Jobs/application API. Naukri, Foundit, Instahyre, Wellfound, Cutshort, Hirist, X/Twitter and iimjobs can be discovery targets through permitted public search; complete authenticated coverage and submission are not verified. Prefer original employer descriptions and validate openings before preparation/submission.

## Proposed system

Start locally: one persistent SQLite database with a small dashboard; original and corrected master resume; immutable tailored PDF files; complete job-description snapshots; application history and evidence; daily report files. No external CRM is required initially. Cloud access from other devices requires an eligible cloud CRM or hosted dashboard.

- Candidate facts distinguish user-confirmed information, resume claims and gaps.
- Deduplication uses employer/requisition IDs and canonical URLs across sources. Before any retry, check uncertain submission state; never assume a failed browser action means no submission occurred.
- Record every required CRM field plus compensation components, source-check timestamps, full description snapshot, score breakdown, source confidence, evidence of submission and dated status history.
- Allow manual statuses, notes, recruiter communications, interview preparation and follow-up updates. Keep the requested stage list and preserve closed/expired records.
- Tailor from one truthful master, preserve title/dates and design, use clearly named per-company files and attach exact file/hash to each application. Never add unsupported skills or metrics.
- Applied status requires confirmed receipt/success screen/reference. Form filled or submit clicked is not confirmation.
- Gmail integration: read recruitment-related messages only after installation/connection/testing. Record responses and draft follow-ups; sends need authorization for the actual recipient/message.
- Analytics: confirmed applications/week/month, shortlisting/interview/rejection/offer rates, category/platform/resume outcomes and known salary averages. Keep unknown salaries out of averages and report sample sizes. Attribute results to the actual submitted resume, not a subsequently edited version.

Use the requested weights: technical 30%, experience 20%, compensation 20%, growth 15%, flexibility 10%, reputation 5%. Score components from evidence. Unknown compensation remains unknown with a score interval reflecting its unresolved 20 points. Never assume a salary. Proposed shortlist threshold 75/100, with 65–74 watchlist. Gate against fraud/fees, expired listings, duplicates, substantial essential-skill/experience gaps, incompatible geography/availability and salary below net floor.

## Schedule and runtime decision

Proposed daily schedule in IST: 09:00 discovery; 14:00 verification/scoring/resume preparation; 19:00 authorized applications, confirmation checks, follow-ups and daily report. Include weekly analytics in Sunday's evening cycle. Use one shared queue/database with idempotent stages and a run log; report actual unique counts, rejection reasons, prepared resumes, confirmed submissions, approval holds, responses, follow-ups and top 3–5 qualifying opportunities (fewer if fewer qualify).

Official scheduled-task documentation says local/project tasks require the computer powered on and the desktop app running. They can operate in the background between conversations, but cannot execute with the computer off or app fully exited. https://learn.chatgpt.com/docs/automations?surface=app

Native recurring-task tools are available but no schedule was created or tested. Firecrawl authenticated cloud monitor listing succeeded with no existing monitors; monitor creation/execution is untested. Cloud monitoring can address discovery while PC is off, not prove that resume preparation/database updates/applications are running. Full PC-independent operation requires eligible web scheduled tasks with cloud-accessible context/storage or a hosted worker, funded runtime/API credentials and tested permitted application routes. The local F: folder cannot be accessed by a web task. Do not claim an end-to-end service is operational until each stage and a scheduled run have succeeded.

## Permissions and unanswered decisions

- Approve the proposed seven-role strategy, compensation/location/90-day-notice filters and architecture before Phase 3, as requested by the user.
- Decide whether keeping this PC/app running is acceptable or whether full PC-off operation is mandatory.
- Install/connect Gmail for recruitment mail monitoring; it was found uninstalled, and suggested. No email access exists yet. Outlook Email and Notion are optional uninstalled alternatives. Google Sheets/Drive connector reported disabled by admin/unavailable.
- Sign into intended job accounts yourself; use permitted saved sessions and test each site's form. No credentials in chat.
- Confirm actual employment/history and which tasks/metrics describe completed work; share proficiency depth and actual ownership. Clarify which North India cities are acceptable and whether out-of-region Rs 1 lakh threshold is take-home. Provide current compensation breakdown if available.
- Agree a discovery/API/cloud cost cap before paid standing services or subscriptions.
- Routine permitted preparation and submission are within user scope once inputs/routes are reliable. Individual approval is retained where workflow requires it, for sensitive personal answers, assessments, legal declarations and additional personal documents. Recruiter sends require their own authorization. CAPTCHAs/security restrictions are never bypassed.

## Automation boundary

- Fully automatable once built/tested and inputs confirmed: permitted public discovery, source verification, deduplication, scoring, truthful tailoring/render checks, tracker/history updates, analytics, reports, follow-up detection/drafts and connected recruitment-email classification.
- Conditional automation: signed-in permitted forms, ordinary standard answers, resume upload and submission with verified receipts, subject to site/workflow rules and user's approval gates.
- Approval/manual steps: login/security challenges, sensitive form data, tests/assessments, declarations/contracts, extra documents and unauthorized recruiter communications.
- Currently unsupported/unproven: universal hands-free job-board submission, guaranteed access to all platforms, knowing recruiter views absent platform evidence, full local operation while PC/app is off, any claim that interviews/offers are guaranteed.
