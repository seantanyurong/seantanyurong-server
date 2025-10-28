import { Client } from '@notionhq/client';
import { parseISO, addWeeks, format } from 'date-fns';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const SUBSCRIPTIONS_DATASOURCE_ID = '298646e6-5266-80ce-9e1e-000bdcd5beb7';
const EXPENSES_DATASOURCE_ID = '298646e6-5266-80b2-9486-000b83774804';

export const getSubscriptions = async () => {
  const { results } = await notion.databases.query({
    data_source_id: SUBSCRIPTIONS_DATASOURCE_ID,
  });

  return results;
};

export const updateOrderConstantsToNextOrderGroup = async () => {
  const orderConstants = await getOrderConstants();
  const newOrderGroup = orderConstants.orderGroup + 1;
  const newPickupDate = format(
    addWeeks(parseISO(orderConstants.pickupDate), 1),
    'yyyy-MM-dd',
  );
  const newDeliveryDate = format(
    addWeeks(parseISO(orderConstants.deliveryDate), 1),
    'yyyy-MM-dd',
  );

  await notion.pages.update({
    page_id: ORDER_CONSTANTS_PAGE_ID,
    properties: {
      'Order Group': {
        number: newOrderGroup,
      },
      'Current Order': {
        number: 0,
      },
      'Pickup Date': {
        date: {
          start: newPickupDate,
        },
      },
      'Delivery Date': {
        date: {
          start: newDeliveryDate,
        },
      },
    },
  });
};
