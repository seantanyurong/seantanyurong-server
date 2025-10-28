import 'dotenv/config';
import {
  getSubscriptions,
  createNewExpense,
  updateMonthlyExpensesWithSubscriptions,
} from './utils/notion_helper.js';

const newExpenses = {
  name: 'Test Expense',
  amount: 100,
  overrideDate: '2023-01-01',
  category: 'Subscription',
};

await updateMonthlyExpensesWithSubscriptions();

console.log('done');
