import { parseISO, getDate, format } from 'date-fns';

export const getSubscriptionDateForThisMonth = (startDate) => {
  const date = parseISO(startDate);
  const day = getDate(date);
  const today = new Date();
  const newDate = new Date(
    today.getFullYear(),
    today.getMonth(), // zero-based
    day,
  );

  const iso = format(newDate, 'yyyy-MM-dd');
  return iso;
};
