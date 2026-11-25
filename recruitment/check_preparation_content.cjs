const fs=require('fs'),assert=require('assert');
const script=fs.readFileSync('preparation_content.js','utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const run=new AsyncFunction('base','output',script);
const profile=JSON.parse(fs.readFileSync('candidate_profile.json','utf8'));
const today=new Date(Date.now()+330*60000).toISOString().slice(0,10);
const master={getCellValueAsString:()=>JSON.stringify(profile)};
const updates=[],outputValues={};
function record(id,overrides={}){const values={'Application ID':id,'Company':'Fixture Employer','Job Title':'Applied AI Engineer','Job URL':'https://fixture.example/jobs/'+id,
'Category':'Applied GenAI','Job Description Snapshot':('LangChain RAG Qdrant LangSmith semantic caching backend integration. ').repeat(15),'Required Skills':'LangChain, RAG, Qdrant','Preferred Skills':'Kubernetes, Terraform',
'Technical Score':85,'Match Score Lower':78,'Match Score Upper':98,'Listing Verification':'Verified live','Source Checked':today,'Evaluation Decision':'Hold','Status':'Discovered','Resume PDF':[],
'Submission Confirmed':false,'Material Preparation State':'Not prepared','Tailored Resume Content':'','Notes':'Fixture input',...overrides};
return {id,getCellValue:k=>values[k],getCellValueAsString:k=>String(values[k]??'')};}
const rows=[record('one'),record('two',{'Status':'Applied','Submission Confirmed':true}),record('three',{'Resume PDF':[{id:'attFixture'}]}),record('four',{'Source Checked':'2020-01-01'}),record('five',{'Evaluation Decision':'Reject'})];
const apps={selectRecordsAsync:async()=>({records:rows}),updateRecordAsync:async(id,fields)=>updates.push({id,fields})};
const facts={sel85afa145748c5a:async()=>master};
const base={getTable:id=>id==='tbla3ef4c6645989b'?facts:apps};
(async()=>{
await run(base,{set:(k,v)=>outputValues[k]=v});
assert.equal(updates.length,1);assert.equal(updates[0].id,'one');
const f=updates[0].fields;
assert.equal(f['Material Preparation State'].name,'Content ready; PDF needed');
assert.ok(!('Status' in f));assert.ok(!('Resume PDF' in f));assert.ok(!('Resume Version' in f));
assert.match(f['Tailored Resume Content'],/System Engineer \(AI Cloud\)/);
assert.match(f['Tailored Resume Content'],/WaahAds — Software Engineer/);
assert.match(f['Tailored Resume Content'],/Designed and tested/);
assert.ok(!f['Tailored Resume Content'].includes('Terraform'));
assert.ok(!f['Tailored Resume Content'].includes('Kubernetes'));
assert.ok(!f['Tailored Resume Content'].includes('production RAG'));
assert.match(f['Notes'],/Catalog fact IDs:/);
assert.match(f['Notes'],/PDF has not been generated/);
assert.equal(JSON.parse(f['Application Answers']).notice_period_days,90);
assert.equal(outputValues.contentPreparedCount,1);
console.log('PASS: only fresh verified eligible records prepared; submitted/PDF/stale/reject records skipped; truthful scoped catalog wording, unsupported technologies omitted, actual titles preserved, 90-day notice and no PDF/status/version claims.');
})().catch(e=>{console.error(e);process.exit(1)});
