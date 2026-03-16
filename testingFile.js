import 'dotenv/config';
import {
  createWeeklyReview,
} from './utils/notion_helper.js';


await createWeeklyReview();
console.log('done');

