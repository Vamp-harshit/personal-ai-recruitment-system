const fs=require('fs'),assert=require('assert');
const payload=JSON.parse(fs.readFileSync('discovery_quality_repair_payload.json','utf8').replace(/^\uFEFF/,''));
const loop=payload.nodes.find(n=>n.type==='repeatingGroup'),gate=loop.nodes.find(n=>n.type==='conditionalGroup');
function val(e,job,duplicate=false){
 if(e===null||typeof e!=='object')return e;
 if(e.$ref){if(e.path.includes('sel7f656839ee1e19'))return job;if(e.path.includes('records'))return duplicate?[{id:'existing'}]:[];throw new Error('Unexpected ref');}
 if(e.fn==='pickBranchData')return val(e.args[0],job,duplicate);
 if(e.fn==='readProperty')return val(e.args[0],job,duplicate)[e.args[1]];
 if(e.fn==='lowercase')return String(val(e.args[0],job,duplicate)||'').toLowerCase();
 if(e.fn==='map'){const rows=val(e.args[0],job,duplicate),key=e.args[1].args[0];return rows.map(r=>r[key]);}
 throw new Error('Unsupported expression '+JSON.stringify(e));
}
function passes(job,duplicate=false){return gate.branches[0].condition.conditions.every(c=>{
 const l=val(c.left,job,duplicate),r=val(c.right,job,duplicate);
 if(c.operator==='isEmpty')return Array.isArray(l)?l.length===0:l==null||l==='';
 if(c.operator==='>=')return l>=r;if(c.operator==='<=')return l<=r;
 if(c.operator==='contains')return String(l).includes(String(r));
 if(c.operator==='doesNotContain')return !String(l).includes(String(r));
 throw new Error('Unexpected operator '+c.operator);
});}
const observedFacts={company:'Relinns Technologies',technicalScore:70,experienceScore:60,canonicalUrl:'https://cutshort.io/',location:'Sahibzada Ajit Singh Nagar, Punjab',listingVerification:'Verified live'};
assert.equal(passes(observedFacts),false);
assert.equal(passes({...observedFacts,technicalScore:90,experienceScore:90}),false);
assert.equal(passes({...observedFacts,canonicalUrl:'https://fixture-employer.example/jobs/one',experienceScore:90}),false);
assert.equal(passes({...observedFacts,canonicalUrl:'https://fixture-employer.example/jobs/one',technicalScore:90}),false);
assert.equal(passes({...observedFacts,canonicalUrl:'https://fixture-employer.example/jobs/one',technicalScore:90,experienceScore:90}),true);
assert.equal(passes({...observedFacts,canonicalUrl:'https://fixture-employer.example/jobs/one',technicalScore:90,experienceScore:90},true),false);
const actions=[];function walk(nodes){for(const n of nodes){if(n.type==='createRecord')actions.push(n);if(n.nodes)walk(n.nodes);for(const b of n.branches||[])walk(b.nodes||[]);}}walk(payload.nodes);
assert.equal(actions.filter(n=>n.inputs.tableId==='tblbef0fd137c7a43').length,0);
assert.equal(gate.branches[0].nodes[0].inputs.tableId,'tbl2a6f8bcea45def');
assert.match(gate.branches[0].nodes[0].inputs.fields.fldf10a71ecadeebe.template[0],/verification: Unverified/);
const ai=payload.nodes.find(n=>n.type==='aiGenerateStructuredOutput');
assert.deepEqual(ai.inputs.outputSchema.response.properties.jobs.items.properties.listingVerification.enum,['Unverified']);
assert.ok(ai.inputs.prompt.template.some(x=>typeof x==='string'&&x.includes('Mohali')&&x.includes('NORTH INDIA')));
console.log('PASS: observed Relinns70/60 and Cutshort domain each fail literal gates; good-score board URL still fails; individual low-score tests fail; duplicates fail; no Apps-create node exists; Intake source is hardcoded Unverified; AI cannot output Verifiedlive; NorthIndia/Mohali definition present.');
