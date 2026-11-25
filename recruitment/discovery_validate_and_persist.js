const cfg = input.config();
function parsed(v) { return typeof v === 'string' ? JSON.parse(v) : v; }
const response = parsed(cfg.research);
const constraints = parsed(cfg.constraintsJson);
const experienceYears = Number(cfg.experienceMonths) / 12;
if (!response || !Array.isArray(response.jobs)) throw new Error('Discovery response has no typed jobs array.');
const table = base.getTable('tblbef0fd137c7a43');
const prior = await table.selectRecordsAsync({fields:['Company','Requisition ID','Job URL','Deduplication Key','Application ID']});
function clean(value, maximum = 100000) { return String(value ?? '').trim().slice(0, maximum); }
function norm(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]/g,''); }
function canonical(raw) {
  try {
    const u = new URL(clean(raw));
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || /(^localhost$|\.local$|^(127|10|192\.168)\.|^172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(u.hostname)) return '';
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    for (const key of Array.from(u.searchParams.keys())) if (/^(utm_|ref$|referrer$|source$|src$|tracking|trk|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    u.pathname = u.pathname.replace(/\/+$/,'') || '/';
    return u.toString();
  } catch { return ''; }
}
function reqKey(company, req) { return req ? 'req:' + norm(company) + ':' + clean(req).toLowerCase() : ''; }
function hash(value) { let x = 2166136261; for (let i=0;i<value.length;i++) x = Math.imul(x ^ value.charCodeAt(i),16777619)>>>0; return x.toString(16).padStart(8,'0'); }
const seen = new Set();
const applicationIds = new Set(prior.records.map(r=>r.getCellValueAsString('Application ID')).filter(Boolean));
for (const record of prior.records) {
  const url=canonical(record.getCellValueAsString('Job URL'));
  const req=reqKey(record.getCellValueAsString('Company'),record.getCellValueAsString('Requisition ID'));
  const key=record.getCellValueAsString('Deduplication Key');
  if(url) seen.add('url:' + url); if(req) seen.add(req); if(key) seen.add(key);
}
function positive(v) { const x = clean(v).replace(/,/g,''); if(!/^\d+(\.\d+)?$/.test(x)) return null; const n=Number(x); return Number.isFinite(n) && n>0 ? n : null; }
function score(v) { const n=Number(v); return Number.isFinite(n) ? Math.max(0,Math.min(100,Math.round(n))) : 0; }
function isoDate(v) { const text=clean(v); const time=Date.parse(text+'T00:00:00Z'); return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(time) && new Date(time).toISOString().slice(0,10)===text ? text : ''; }
function fieldSelect(name) { return {name}; }
const now = new Date(), date = new Date(now.getTime()+330*60000).toISOString().slice(0,10);
const jobs = response.jobs.slice(0,10);
let invalid=0, duplicates=0, rejected=0, held=0, shortlisted=0;
const created=[], candidates=[];
for (const job of jobs) {
  const url=canonical(job.jobUrl), req=reqKey(job.company,clean(job.requisitionId));
  if(!url || !clean(job.company) || !clean(job.jobTitle)) { invalid++; continue; }
  const key = req || 'url:' + url;
  if(seen.has(key) || seen.has('url:'+url)) {duplicates++;continue;}
  seen.add(key);seen.add('url:'+url);if(req)seen.add(req);
  candidates.push({job,url,key});
}
async function verifyPage(url, title, description) {
  let timer;
  try {
    const r=await Promise.race([fetch(url,{method:'GET',redirect:'follow'}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Source fetch timeout')),10000);})]);
    clearTimeout(timer);
    if(r.status===404||r.status===410) return {state:'Closed',evidence:'Original URL returned HTTP '+r.status};
    if(!r.ok) return {state:'Inaccessible',evidence:'Original URL returned HTTP '+r.status};
    const html=(await r.text()).slice(0,1500000);
    if(/job (is|has been) (no longer available|removed)|position (has been|is) filled|posting (has )?expired|this job is no longer available/i.test(html)) return {state:'Unverified',evidence:'Possible closed-listing text in original page; needs source review.'};
    const words=clean(title).toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>3&&!['with','senior','junior'].includes(x));
    const titlePresent=words.length>0&&words.every(word=>html.toLowerCase().includes(word));
    const plain=(value)=>String(value).toLowerCase().replace(/<[^>]*>/g,' ').replace(/&[a-z0-9#]+;/gi,' ').replace(/\\[nrt]/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
    const sourceText=plain(html), jdWords=plain(description).split(' ');
    const starts=[0,Math.floor(jdWords.length/3),Math.floor(jdWords.length*2/3)];
    const excerpts=starts.map(start=>jdWords.slice(start,start+7).join(' ')).filter(x=>x.length>=25);
    const matchedExcerpts=excerpts.filter(x=>sourceText.includes(x)).length;
    const jdCorroborated=matchedExcerpts>=2;
    const applyPresent=/apply (for|to|now)|submit (your )?application|application[-_ ]form|applicationForm|applyUrl|apply_url|jobs\.lever\.co\/[^\s]*\/apply/i.test(html);
    return {state:titlePresent&&applyPresent&&jdCorroborated?'Page corroborated':'Unverified',evidence:'HTTP '+r.status+'; title tokens '+(titlePresent?'found':'not found')+'; application marker '+(applyPresent?'found':'not found')+'; original JD excerpts matched '+matchedExcerpts+'/3. HTML check supplements the AI full-description read.'};
  } catch(e) {clearTimeout(timer);return {state:'Inaccessible',evidence:clean(e.message,240)};}
}
const checks=await Promise.all(candidates.map(x=>verifyPage(x.url,x.job.jobTitle,x.job.jobDescription)));
for(let index=0;index<candidates.length;index++){
  const {job:g,url,key}=candidates[index], check=checks[index];
  const reason=[], hardReject=[];
  let verification='Unverified';
  if(check.state==='Closed'||g.listingState==='Closed') {verification='Closed';hardReject.push('Listing closed or original URL removed.');}
  else if(check.state==='Inaccessible') {verification='Inaccessible';reason.push('Independent original-page fetch could not corroborate availability: '+check.evidence);}
  else if(g.listingState==='Open' && check.state==='Page corroborated' && clean(g.jobDescription).length>=400 && clean(g.applyEvidence).length>=8 && clean(g.sourceEvidence).length>=8) verification='Verified live';
  else reason.push('Full job description and accepting-applications evidence are not fully corroborated.');
  if(!g.employerLegitimate||clean(g.feesOrScamEvidence)) hardReject.push('Employer legitimacy unresolved or recruitment-fee/scam evidence: '+clean(g.feesOrScamEvidence));
  if(!g.essentialSkillsMostlySupported) hardReject.push('Most essential skills are not supported by the attested profile.');
  const minExperience=Number(g.minimumExperienceYears);
  if(Number.isFinite(minExperience)&&minExperience>=0&&minExperience>experienceYears+1) hardReject.push('Essential experience requirement substantially exceeds confirmed experience.');
  else if(Number.isFinite(minExperience)&&minExperience>experienceYears) reason.push('Experience shortfall requires recruiter confirmation; do not round candidate experience upward.');
  else if(!Number.isFinite(minExperience)||minExperience<0) reason.push('Required experience not established.');
  const notice=g.noticeCompatibility;
  if(notice==='Incompatible') hardReject.push('Posted notice/joining requirement conflicts with '+constraints.notice_period_days+' days.');
  else if(notice!=='Compatible'||!clean(g.noticeEvidence)) reason.push('Confirm employer accepts '+constraints.notice_period_days+'-day notice; shorter notice is unconfirmed.');
  let ctc=positive(g.annualCtcINR),fixed=positive(g.fixedAnnualINR),gross=positive(g.monthlyGrossINR),net=positive(g.monthlyNetLowerINR);
  const salaryEvidence=clean(g.salaryEvidence), salarySource=canonical(g.salarySourceUrl), breakdown=clean(g.compensationBreakdown);
  const compensationStated=!!clean(g.salaryAdvertised)&&clean(g.salaryAdvertised).toLowerCase()!=='unknown'&&!!salaryEvidence&&!!salarySource;
  if(!compensationStated) {ctc=null;fixed=null;gross=null;net=null;}
  if(!['Advertised net','Calculated from verified breakdown'].includes(g.netBasis)||!salaryEvidence||!salarySource||(g.netBasis==='Calculated from verified breakdown'&&(!breakdown||!gross))) net=null;
  if(ctc&&fixed&&fixed>ctc) {reason.push('Fixed salary exceeds reported CTC; compensation data inconsistent.');net=null;}
  if(gross&&net&&net>gross) {reason.push('Reported net pay exceeds gross; compensation data inconsistent.');net=null;}
  let salaryQualification=!compensationStated?'Unknown':net?'Meets floor':'Needs breakdown';
  const floor=Number(constraints.minimum_monthly_in_hand_inr||40000);
  if(net&&net<floor) {salaryQualification='Below floor';hardReject.push('Conservative monthly in-hand estimate below ₹'+floor+'.');}
  else if(!net) reason.push('Salary floor pending: do not convert CTC or advertised annual range into verified monthly take-home.');
  const location=g.locationCompatibility;
  if(location==='Incompatible') hardReject.push('Location/remote eligibility incompatible.');
  else if(location==='Outside North India') {
    if(!net||net<=Number(constraints.outside_north_india_monthly_in_hand_floor||100000)) reason.push('Outside North India requires confirmed monthly in-hand above ₹'+Number(constraints.outside_north_india_monthly_in_hand_floor||100000)+'.');
  } else if(location==='India remote') {
    if(g.workMode!=='Remote'||!clean(g.remoteIndiaEvidence)) reason.push('India remote eligibility needs explicit original-source confirmation.');
  } else if(location!=='North India') reason.push('Eligible work location not established.');
  const deadline=isoDate(g.deadline);
  if(deadline&&deadline<date) {hardReject.push('Application deadline passed.');verification='Closed';}
  const preference=Number(constraints.preferred_monthly_in_hand_inr||50000);
  const salary = net ? net>=preference ? Math.min(100,80+(net-preference)/2500) : Math.max(0,Math.min(80,60+(net-floor)/Math.max(1,preference-floor)*20)) : 0;
  const technical=score(g.technicalScore),experience=score(g.experienceScore);
  const growth=score(g.growthScore),flexibility=score(g.flexibilityScore),reputation=score(g.reputationScore);
  const lower=Math.round(technical*.30+experience*.20+salary*.20+growth*.15+flexibility*.10+reputation*.05);
  const upper=net?lower:Math.min(100,lower+20);
  let decision=hardReject.length?'Reject':reason.length?'Hold':lower>=75?'Proceed':'Hold';
  if(decision==='Hold'&&!reason.length)reason.push('Evidence-based match score below the 75-point shortlist threshold.');
  if(decision==='Reject')rejected++;else if(decision==='Hold')held++;else shortlisted++;
  let applicationId='APP-'+hash(key), suffix=1;
  while(applicationIds.has(applicationId))applicationId='APP-'+hash(key)+'-'+(suffix++);
  applicationIds.add(applicationId);
  const fields={
    'Application ID':applicationId, 'Company':clean(g.company,300), 'Job Title':clean(g.jobTitle,500), 'Job URL':url,
    'Requisition ID':clean(g.requisitionId,300), 'Deduplication Key':key, 'Date Discovered':date,
    'Job Description Snapshot':clean(g.jobDescription), 'Required Experience':clean(g.requiredExperience), 'Required Skills':clean(g.requiredSkills), 'Preferred Skills':clean(g.preferredSkills),
    'Salary Advertised':clean(g.salaryAdvertised)||'Unknown', 'Compensation Breakdown':breakdown+'\nEvidence: '+salaryEvidence+'\nSource: '+salarySource+'\nNet basis: '+clean(g.netBasis),
    'Salary Qualification':fieldSelect(salaryQualification), 'Location':clean(g.location,500), 'Work Mode':fieldSelect(['Remote','Hybrid','On-site'].includes(g.workMode)?g.workMode:'Unknown'),
    'Status':fieldSelect(decision==='Proceed'?'Shortlisted':verification==='Closed'?'Closed':'Discovered'), 'Evaluation Decision':fieldSelect(decision),
    'Category':fieldSelect(['Node.js Backend','Python Backend','Applied GenAI','SDE I','Full-stack','API Automation','Data Ingestion','Cloud / DevOps','QA / SDET','Other'].includes(g.category)?g.category:'Other'),
    'Technical Score':technical, 'Experience Score':experience, 'Salary Score':salary,'Growth Score':growth,'Flexibility Score':flexibility,'Reputation Score':reputation,
    'Match Score Lower':lower,'Match Score Upper':upper,'Compensation Known':compensationStated,
    'Why Profile Matches':clean(g.whyMatches),'Gaps':clean(g.gaps),'Hold or Rejection Reason':[...hardReject,...reason].join('\n'),
    'Platform':clean(g.platform,300),'Source Checked':date,'Listing Verification':fieldSelect(verification),
    'Approval Needed':decision==='Proceed'?'Before submission: any sensitive questions, declarations, assessments or extra documents.':'Resolve hold/rejection reasons before any submission.',
    'Approval Granted':false,'Submission Confirmed':false,
    'Notes':clean(g.notes)+'\nOriginal-source evidence: '+clean(g.sourceEvidence)+'\nApply evidence: '+clean(g.applyEvidence)+'\nIndependent fetch: '+check.evidence+
      '\nNotice evidence: '+clean(g.noticeEvidence)+'\nIndia remote evidence: '+clean(g.remoteIndiaEvidence)+'\nGrowth evidence: '+clean(g.growthEvidence)+
      '\nDiscovery source coverage: '+clean(response.sourceCoverage)+'\nScoring: 30/20/20/15/10/5. Unknown net compensation contributes 0–20 points; this score is a ranking measure, not shortlist probability. Candidate metrics are user-attested.',
    'Last Modified':date
  };
  if(ctc)fields['Annual CTC INR']=ctc;if(fixed)fields['Fixed Annual INR']=fixed;if(gross)fields['Monthly Gross INR']=gross;if(net)fields['Estimated Monthly In-hand INR']=net;
  if(deadline)fields['Deadline']=deadline;
  const recordId=await table.createRecordAsync(fields);
  created.push(recordId);
}
output.set('uniqueCreated',created.length);output.set('duplicateCount',duplicates);output.set('invalidCount',invalid);
output.set('shortlistedCount',shortlisted);output.set('heldCount',held);output.set('rejectedCount',rejected);
output.set('createdRecordIds',created);output.set('sourceCoverage',clean(response.sourceCoverage));
output.set('runSummary',JSON.stringify({date,uniqueCreated:created.length,duplicates,invalid,shortlisted,held,rejected,sourceCoverage:clean(response.sourceCoverage),researchLimitations:clean(response.limitations)}));
