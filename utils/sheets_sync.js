import { google } from 'googleapis';
import { Client } from '@notionhq/client';
import fs from 'fs';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const EXPENSES_DATASOURCE_ID = '298646e6-5266-80b2-9486-000b83774804';
const SPREADSHEET_ID = process.env.FIRE_SHEET_ID || '1PqeQVxGeaft5OuFlP5821SUDEbTE7WqOGHiAIZ99LNc';

// Service account JSON passed as env var (base64-encoded) OR path to file
function getGoogleAuth() {
  let creds;
  if (process.env.GOOGLE_SA_B64) {
    creds = JSON.parse(Buffer.from(process.env.GOOGLE_SA_B64, 'base64').toString('utf8'));
  } else if (process.env.GOOGLE_SA_FILE) {
    creds = JSON.parse(fs.readFileSync(process.env.GOOGLE_SA_FILE, 'utf8'));
  } else {
    throw new Error('GOOGLE_SA_B64 or GOOGLE_SA_FILE must be set');
  }
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

function lastCompletedMonth() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(first.getTime() - 24 * 60 * 60 * 1000); // last day of prev month
  return {
    year: last.getFullYear(),
    month: last.getMonth() + 1, // 1-indexed
  };
}

async function queryNotionMonth(year, month) {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const { results } = await notion.dataSources.query({
    data_source_id: EXPENSES_DATASOURCE_ID,
    filter: {
      and: [
        { property: 'Date of Expense', date: { on_or_after: monthStart } },
        { property: 'Date of Expense', date: { before: next } },
      ],
    },
    page_size: 100,
  });
  return results;
}

function aggregateByCategory(rows) {
  const totals = {};
  for (const row of rows) {
    const cat = row.properties['Category']?.select?.name;
    const amt = row.properties['Amount']?.number;
    if (!cat || !amt) continue;
    totals[cat] = (totals[cat] || 0) + amt;
  }
  return totals;
}

async function getYearSheetId(sheets, year) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties.title,sheets.properties.sheetId',
  });
  const match = meta.data.sheets.find(
    (s) => s.properties.title === String(year) || s.properties.title.endsWith(String(year)),
  );
  return match?.properties.sheetId ?? null;
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

async function getMonthColumn(sheets, year, month) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${year}!A2:P2`,
  });
  const header = res.data.values?.[0] ?? [];
  // header[0] = 'Actual' (A), header[1] = 'Currency' (B), header[2] = 'January' (C) ...
  const want = MONTHS[month - 1]; // month is 1-12 -> 'january'...
  for (let i = 0; i < header.length; i++) {
    const v = String(header[i] || '').trim().toLowerCase();
    if (v === want) return { col: i + 1 }; // i=2 (January) -> C (3)
  }
  return null;
}

async function getCategoryRows(sheets, year) {
  // Only scan the Actuals block (rows 1-40). The forecast section (rows 42+)
  // has its own 'Travel'/'Parents'/'Fun' labels and must NOT be touched.
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${year}!A1:A40`,
  });
  const map = {};
  (res.data.values ?? []).forEach((row, i) => {
    if (row?.[0]) map[String(row[0]).trim()] = i + 1;
  });
  return map;
}

export async function syncExpensesToSheet(targetYear = null, targetMonth = null) {
  const { year, month } =
    targetYear && targetMonth
      ? { year: targetYear, month: targetMonth }
      : lastCompletedMonth();

  console.log(`[SYNC] Syncing Notion expenses for ${year}-${String(month).padStart(2, '0')} -> sheet '${year}'`);

  const auth = await getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Sheet must exist for the year
  const sheetId = await getYearSheetId(sheets, year);
  if (!sheetId) {
    console.error(`[SYNC] No sheet for year ${year} found.`);
    return { ok: false, error: `no sheet for ${year}` };
  }

  // Notion data
  const rows = await queryNotionMonth(year, month);
  const totals = aggregateByCategory(rows);
  console.log(`[SYNC] ${rows.length} expenses ->`, JSON.stringify(totals));
  if (Object.keys(totals).length === 0) {
    console.log('[SYNC] Nothing to write.');
    return { ok: true, totals };
  }

  // Sheet positions
  const monthCol = await getMonthColumn(sheets, year, month);
  if (!monthCol) {
    console.error('[SYNC] Could not map month column.');
    return { ok: false, error: 'month column not found' };
  }
  const colLetter = String.fromCharCode(64 + monthCol.col);
  console.log(`[SYNC] month=${month} -> col=${colLetter} (idx ${monthCol.col})`);

  const catRows = await getCategoryRows(sheets, year);

  // Build cell updates
  const updates = [];
  for (const [cat, amt] of Object.entries(totals)) {
    let row = catRows[cat];
    if (!row) {
      // new category -> append after last used row in col A
      const used = Object.keys(catRows).length;
      row = used + 2; // header-ish offset; row 1 is title, row 2 is header
      updates.push({ range: `${year}!A${row}`, values: [[cat]] });
    }
    updates.push({ range: `${year}!${colLetter}${row}`, values: [[Math.round(amt * 100) / 100]] });
  }

  const result = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
  });
  console.log(`[SYNC] ✅ ${result.data.totalUpdatedCells} cells updated`);
  return { ok: true, totals, updatedCells: result.data.totalUpdatedCells };
}
