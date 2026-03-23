import 'dotenv/config';
import {
  createDailyTimeTrackerPages,
} from './utils/notion_helper.js';


await createDailyTimeTrackerPages();
console.log('done');

