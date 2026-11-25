const record = await base.getTable('tbla3ef4c6645989b').sel85afa145748c5a('rec1758a94dd847c7');
if (!record) throw new Error('Confirmed MASTER_PROFILE is missing. Discovery stopped.');
const p = JSON.parse(record.getCellValueAsString('Value'));
if (!p.operational_state || p.operational_state.strategy_approved !== true || !p.resume_claims_user_attested) throw new Error('Approved, user-attested profile is required.');
const claims = p.resume_claims_user_attested;
const c = p.constraints_confirmed_by_user || {};
const now = new Date();
const india = new Date(now.getTime() + 330 * 60000);
const years = india.getUTCFullYear(), month = india.getUTCMonth();
let experienceMonths = 0;
for (const job of claims.employment || []) {
  const [sy, sm] = job.start.split('-').map(Number);
  const end = job.end ? job.end.split('-').map(Number) : [years, month + 1];
  experienceMonths += Math.max(0, (end[0] - sy) * 12 + (end[1] - sm) + (job.end ? 1 : 0));
}
const text = String(p.resume_text || '').replace(/\u00a0/g,' ').replaceAll(String(p.identity_confirmed_by_user?.full_name || '__no_name__'),'[candidate]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[contact omitted]').replace(/\+?91[ -]?\d{10}/g,'[phone omitted]');
const safe = {
  employment: claims.employment, education: claims.education,
  work_evidence: claims.work_evidence_in_resume, project: claims.project,
  scope_rule: claims.application_rule,
  skills_and_resume_evidence: text,
  experience_months_as_of_today: experienceMonths,
  search_constraints: {
    notice_period_days: Number(c.notice_period_days || 90),
    reduced_notice_confirmed: false,
    current_city: c.current_city || 'Kurukshetra',
    minimum_monthly_in_hand_inr: Number(c.minimum_monthly_in_hand_inr || 40000),
    preferred_monthly_in_hand_inr: Number(c.preferred_minimum_monthly_in_hand_inr || 50000),
    normal_relocation_region: c.normal_relocation_region || 'North India',
    outside_north_india_monthly_in_hand_floor: Number(c.outside_north_india_monthly_pay_threshold_inr || 100000),
    search_fixed_annual_range_inr: p.proposed_strategy_pending_approval?.core_fixed_annual_inr || [700000,1000000],
    search_stretch_fixed_annual_range_inr: p.proposed_strategy_pending_approval?.stretch_fixed_annual_inr || [1000000,1400000]
  }
};
output.set('profileText', JSON.stringify(safe));
output.set('runtimeDate', india.toISOString().slice(0,10));
output.set('constraintsJson', JSON.stringify(safe.search_constraints));
output.set('experienceMonths', experienceMonths);
