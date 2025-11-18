import 'dotenv/config';
import {
  // updateMonthlyExpensesWithSubscriptions,
  // updateMonthlyExpensesWithYearlySubscriptions,
  createNewExpense,
} from './utils/notion_helper.js';
// import { getSubscriptionDateForThisMonth } from './utils/general_helper.js';

const newExpenses = {
  name: 'Test Expense',
  amount: 100,
  overrideDate: '2023-01-01',
  category: 'Subscription',
  description: 'Test Description',
};

await createNewExpense(newExpenses);

// await updateMonthlyExpensesWithSubscriptions();
// await updateMonthlyExpensesWithYearlySubscriptions();
//
// const subscriptionDate = getSubscriptionDateForThisMonth('2023-01-01');
// console.log(subscriptionDate);

console.log('done');
