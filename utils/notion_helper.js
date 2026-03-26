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
const TIME_TRACKER_DATASOURCE_ID = '315646e6-5266-8041-a54c-000bdf8d313e';

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
    const today = new Date(); // Saturday when cron fires

    const saturday = new Date(today);
    saturday.setDate(today.getDate() - 2);

    const friday = new Date(today);
    friday.setDate(today.getDate() + 4);

    const weekNumber = getISOWeek(today);
    const year = getISOWeekYear(today);
    const pageName = `${year} W${weekNumber}`;

    const formatDate = (date) => date.toISOString().split('T')[0];

    // Query time tracker entries for Mon–Fri of the past week
    const monday = new Date(today);
    monday.setDate(today.getDate() - 5);
    const pastFriday = new Date(today);
    pastFriday.setDate(today.getDate() - 1);

    const { results: timeEntries } = await notion.dataSources.query({
      data_source_id: TIME_TRACKER_DATASOURCE_ID,
      filter: {
        and: [
          {
            property: 'Date',
            date: { on_or_after: formatDate(monday) },
          },
          {
            property: 'Date',
            date: { on_or_before: formatDate(pastFriday) },
          },
        ],
      },
    });

    const totals = { Work: 0, 'Jobless Club': 0, Studying: 0 };
    for (const entry of timeEntries) {
      const project = entry.properties['Project']?.select?.name;
      const duration = entry.properties['Duration']?.number ?? 0;
      if (project && totals[project] !== undefined) {
        totals[project] += duration;
      }
    }

    const averages = {};
    for (const project of Object.keys(totals)) {
      averages[project] = (totals[project] / 5).toFixed(1);
    }

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

    await notion.blocks.children.append({
      block_id: response.id,
      children: [
        {
          paragraph: {
            rich_text: [{ text: { content: `Work: ${averages['Work']} hrs/day avg` } }],
          },
        },
        {
          paragraph: {
            rich_text: [{ text: { content: `Jobless Club: ${averages['Jobless Club']} hrs/day avg` } }],
          },
        },
        {
          paragraph: {
            rich_text: [{ text: { content: `Studying: ${averages['Studying']} hrs/day avg` } }],
          },
        },
      ],
    });

    return response;
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
};

export const createDailyTimeTrackerPages = async () => {
  const pages = [
    { title: 'constructor', project: 'Work' },
    { title: 'jobless club', project: 'Jobless Club' },
    { title: 'studying', project: 'Studying' },
  ];

  // Adding 8 hours for UTC+8
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
  try {
    for (const page of pages) {
      await notion.pages.create({
        parent: {
          data_source_id: TIME_TRACKER_DATASOURCE_ID,
        },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: page.title,
                },
              },
            ],
          },
          Project: {
            select: {
              name: page.project,
            },
          },
          Date: {
            date: {
              start: today,
            },
          },
          Duration: {
            number: 0,
          },
        },
      });
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
