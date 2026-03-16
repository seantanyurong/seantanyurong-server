import { Client } from '@notionhq/client';
import {
  getSubscriptionDateForThisMonth,
  getSubscriptionDateForThisYear,
} from './general_helper.js';
import { getMonth, getISOWeek, getISOWeekYear } from 'date-fns';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const SUBSCRIPTIONS_DATASOURCE_ID = '298646e6-5266-80ce-9e1e-000bdcd5beb7';
const EXPENSES_DATASOURCE_ID = '298646e6-5266-80b2-9486-000b83774804';
const WEEKLY_REVIEW_DATASOURCE_ID = '29144777-74cf-4496-aae0-de1c94eaa3f8';

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

export const getWeeklyReviewTemplates = async () => {
  const { templates } = await notion.dataSources.listTemplates({
    data_source_id: WEEKLY_REVIEW_DATASOURCE_ID,
  });
  return templates;
};

export const createWeeklyReview = async () => {
  try {
    const today = new Date(); // Monday when cron fires

    const saturday = new Date(today);
    saturday.setDate(today.getDate() - 2);

    const friday = new Date(today);
    friday.setDate(today.getDate() + 4);

    const weekNumber = getISOWeek(today);
    const year = getISOWeekYear(today);
    const pageName = `${year} W${weekNumber}`;

    const formatDate = (date) => date.toISOString().split('T')[0];

    const response = await notion.pages.create({
      parent: {
        data_source_id: WEEKLY_REVIEW_DATASOURCE_ID,
      },
      template: {
        type: 'template_id',
        template_id: 'ce139fcd-ec7f-45e1-923d-8e161c6c63a9',
      },
      properties: {
        Week: {
          title: [
            {
              text: {
                content: pageName,
              },
            },
          ],
        },
        Date: {
          date: {
            start: formatDate(saturday),
            end: formatDate(friday),
          },
        },
      },
    });
    return response;
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
