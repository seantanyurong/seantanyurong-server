import { parseISO, getDate, format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

const SGT = 'Asia/Singapore';

// Get "today" in Singapore time regardless of server timezone (Droplet runs UTC).
// This prevents day-1 subscriptions from being dated in the previous month when
// the cron fires at 00:30 SGT (= 16:30 UTC on the last day of the previous month).
const getTodaySGT = () => fromZonedTime(new Date(), SGT);

export const getSubscriptionDateForThisMonth = (startDate) => {
  const date = parseISO(startDate);
  const day = getDate(date);
  const today = getTodaySGT();
  const newDate = new Date(today.getFullYear(), today.getMonth(), day);
  return format(newDate, 'yyyy-MM-dd');
};

export const getSubscriptionDateForThisYear = (startDate) => {
  const date = parseISO(startDate);
  const day = getDate(date);
  const today = getTodaySGT();
  const newDate = new Date(today.getFullYear(), today.getMonth(), day);
  return format(newDate, 'yyyy-MM-dd');
};
