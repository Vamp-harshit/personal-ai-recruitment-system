const fs=require('fs'),assert=require('assert');
const code=fs.readFileSync('discovery_validate_and_persist.js','utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const fn=new AsyncFunction('input','base','output','fetch','setTimeout','clearTimeout',code);
const constraints={notice_period_days:90,minimum_monthly_in_hand_inr:40000,preferred_monthly_in_hand_inr:50000,outside_north_india_monthly_in_hand_floor:100000};
const g={company:'Fixture Employer',jobTitle:'Backend Software Engineer',jobUrl:'https://fixture.example/jobs/one?utm_source=test',requisitionId:'J-1',platform:'Fixture ATS',sourceEvidence:'Read original employer listing and full JD.',
jobDescription:'Backend Software Engineer role. '.repeat(25),requiredExperience:'1-3 years',minimumExperienceYears:1,requiredSkills:'Node.js, Express, PostgreSQL',preferredSkills:'',
salaryAdvertised:'',annualCtcINR:'',fixedAnnualINR:'',monthlyGrossINR:'',monthlyNetLowerINR:'',netBasis:'Unknown',compensationBreakdown:'',salaryEvidence:'',salarySourceUrl:'',
workMode:'Remote',location:'India',locationCompatibility:'India remote',remoteIndiaEvidence:'Candidates in India may work remotely.',deadline:'',noticeCompatibility:'Compatible',noticeEvidence:'Joining within 90 days accepted.',
category:'Node.js Backend',listingState:'Open',applyEvidence:'Apply for this job.',employerLegitimate:true,feesOrScamEvidence:'',essentialSkillsMostlySupported:true,whyMatches:'Direct backend overlap.',gaps:'',
growthEvidence:'Documented mentorship.',technicalScore:90,experienceScore:90,salaryScore:100,growthScore:80,flexibilityScore:100,reputationScore:80,notes:''};
const rows=[],logs={};const table={selectRecordsAsync:async()=>({records:rows.map((x,i)=>({id:'rec'+i,getCellValueAsString:(k)=>String(x.fields[k]||'')}))}),createRecordAsync:async fields=>{rows.push({fields});return 'rec'+rows.length}};
const base={getTable:()=>table};
const fetched=async()=>({ok:true,status:200,text:async()=>'<h1>Backend Software Engineer</h1><a>Apply for this job</a><main>'+g.jobDescription+'</main>'});
async function run(jobs){await fn({config:()=>({research:{jobs,sourceCoverage:'Fixture only',limitations:''},constraintsJson:JSON.stringify(constraints),experienceMonths:'28'})},base,{set:(k,v)=>logs[k]=v},fetched,setTimeout,clearTimeout);}
(async()=>{
 await run([g,{...g,jobUrl:'https://fixture.example/jobs/one?utm_source=other'}, {...g,requisitionId:'J-2',jobUrl:'https://fixture.example/jobs/two',salaryAdvertised:'₹45,000 net monthly',salaryEvidence:'₹45,000 net monthly',salarySourceUrl:'https://fixture.example/jobs/two',monthlyNetLowerINR:'45000',netBasis:'Advertised net'},
 {...g,requisitionId:'J-3',jobUrl:'https://fixture.example/jobs/three',salaryAdvertised:'₹30,000 net monthly',salaryEvidence:'₹30,000 net monthly',salarySourceUrl:'https://fixture.example/jobs/three',monthlyNetLowerINR:'30000',netBasis:'Advertised net'}]);
 assert.equal(rows.length,3);assert.equal(logs.duplicateCount,1);
 assert.equal(rows[0].fields['Evaluation Decision'].name,'Hold');
 assert.equal(rows[0].fields['Salary Score'],0);
 assert.equal(rows[0].fields['Match Score Upper']-rows[0].fields['Match Score Lower'],20);
 assert.ok(!('Estimated Monthly In-hand INR' in rows[0].fields));
 assert.ok(!('Annual CTC INR' in rows[0].fields));
 assert.equal(rows[0].fields['Submission Confirmed'],false);
 assert.equal(rows[1].fields['Evaluation Decision'].name,'Proceed');
 assert.equal(rows[1].fields['Estimated Monthly In-hand INR'],45000);
 assert.equal(rows[2].fields['Evaluation Decision'].name,'Reject');
 assert.equal(rows[2].fields['Status'].name,'Discovered');
 assert.equal(rows[2].fields['Salary Qualification'].name,'Below floor');
 await run([g]);assert.equal(rows.length,3);assert.equal(logs.uniqueCreated,0);
 await run([{...g,requisitionId:'J-4',jobUrl:'https://fixture.example/jobs/four',salaryAdvertised:'₹80,000 net monthly',salaryEvidence:'₹80,000 net monthly',salarySourceUrl:'https://fixture.example/jobs/four',monthlyNetLowerINR:'80000',netBasis:'Advertised net',locationCompatibility:'Outside North India',workMode:'On-site',location:'Pune'}]);
 assert.equal(rows[3].fields['Evaluation Decision'].name,'Hold');
 assert.match(rows[3].fields['Hold or Rejection Reason'],/Outside North India/);
 console.log('PASS: canonical/requisition dedup, idempotent repeat, salary blanks/20-point range, net floor, relocation gates and confirmed-only submission flag.');
})().catch(e=>{console.error(e);process.exit(1)});
