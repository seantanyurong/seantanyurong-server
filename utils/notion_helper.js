import { Client } from '@notionhq/client';
import {
  getSubscriptionDateForThisMonth,
  getSubscriptionDateForThisYear,
} from './general_helper.js';
import { getMonth } from 'date-fns';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const SUBSCRIPTIONS_DATASOURCE_ID = '298646e6-5266-80ce-9e1e-000bdcd5beb7';
const EXPENSES_DATASOURCE_ID = '298646e6-5266-80b2-9486-000b83774804';

export const getSubscriptions = async (frequency) => {
  const { results } = await notion.dataSources.query({
    data_source_id: SUBSCRIPTIONS_DATASOURCE_ID,
    filter: {
      property: 'Recurring',
      select: {
        equals: frequency,
      },
    },
  });

  return results;
};

export const createNewExpense = async (newExpense) => {
  try {
    const response = await notion.pages.create({
      parent: {
        data_source_id: EXPENSES_DATASOURCE_ID,
      },
      properties: {
        Description: {
          title: [
            {
              text: {
                content: newExpense.description,
              },
            },
          ],
        },
        Amount: {
          number: newExpense.amount,
        },
        'Override Date': {
          date: {
            start: newExpense.overrideDate,
          },
        },
        Category: {
          select: {
            name: newExpense.category,
          },
        },
      },
    });
    return response;
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
};

export const updateMonthlyExpensesWithSubscriptions = async () => {
  try {
    const subscriptions = await getSubscriptions('Monthly');

    for (const subscription of subscriptions) {
      const subscriptionProperties = subscription.properties;

      const subscriptionDate = getSubscriptionDateForThisMonth(
        subscriptionProperties['Start Date'].date.start,
      );

      const newExpense = {
        description: subscriptionProperties['Name'].title[0].plain_text,
        amount: subscriptionProperties['Amount'].number,
        overrideDate: subscriptionDate,
        category: 'Subscription',
      };

      await createNewExpense(newExpense);
    }
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
};

export const updateMonthlyExpensesWithYearlySubscriptions = async () => {
  try {
    const subscriptions = await getSubscriptions('Yearly');

    for (const subscription of subscriptions) {
      const subscriptionProperties = subscription.properties;
      const subscriptionPropertyDate =
        subscriptionProperties['Start Date'].date.start;
      const beenOneYear =
        getMonth(new Date()) === getMonth(new Date(subscriptionPropertyDate));

      if (!beenOneYear) {
        continue;
      }

      const subscriptionDate = getSubscriptionDateForThisYear(
        subscriptionPropertyDate,
      );

      const newExpense = {
        description: subscriptionProperties['Name'].title[0].plain_text,
        amount: subscriptionProperties['Amount'].number,
        overrideDate: subscriptionDate,
        category: 'Subscription',
      };

      await createNewExpense(newExpense);
    }
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
};
