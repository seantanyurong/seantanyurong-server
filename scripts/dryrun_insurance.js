import 'dotenv/config';
import { getInsurancePolicies } from '../utils/notion_helper.js';
import { getSubscriptionDateForThisMonth } from '../utils/general_helper.js';

// READ-ONLY dry run: prints exactly what the monthly cron will book.
// Never creates expenses. Run anytime: node scripts/dryrun_insurance.js
const monthly = await getInsurancePolicies('Monthly');
const yearly = await getInsurancePolicies('Yearly');

console.log('=== MONTHLY GIRO POLICIES (DBS + SC) ===');
for (const p of monthly) {
  const props = p.properties;
  const startDate = props['Start Date'].date.start;
  const yearlyPremium = props['Premium ($)'].number;
  const monthlyAmount = Math.round((yearlyPremium / 12) * 100) / 100;
  console.log(
    `- ${props['Name'].title[0].plain_text} (${props['Company'].select.name}): ` +
    `yearly $${yearlyPremium} -> monthly $${monthlyAmount}, booked ${getSubscriptionDateForThisMonth(startDate)}`,
  );
}
console.log('total monthly: $' + monthly.reduce((acc, p) => acc + Math.round((p.properties['Premium ($)'].number / 12) * 100) / 100, 0));

console.log('\n=== YEARLY GIRO POLICIES (DBS + SC) ===');
for (const p of yearly) {
  const props = p.properties;
  const startDate = props['Start Date'].date.start;
  const nowMonth = new Date().getMonth();
  const startMonth = new Date(startDate).getMonth();
  const firesNow = nowMonth === startMonth;
  console.log(
    `- ${props['Name'].title[0].plain_text} (${props['Company'].select.name}): ` +
    `$${props['Premium ($)'].number}, start ${startDate}, anniversary month=${startMonth + 1} (current month=${nowMonth + 1}), fires this month: ${firesNow}`,
  );
}
