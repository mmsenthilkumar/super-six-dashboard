/**
 * Super Six — Apps Script data endpoint for the Angular dashboard.
 * Sheet (project account): "Senthil - Individual Shares" copy, ID below,
 * tabs 'Tiger - US Markets' and 'IBKR - US Markets'.
 * Layout verified 19 Nov 2026 from a raw dump of the sheet:
 * - Holdings rows first (incl. closed zero-share rows and the BTC row),
 *   then a "Past Transactions" label row, then the MAIN TOTALS row
 *   (blank ticker, invested/unrealised/realised in cols D/E/F),
 *   then "Sell Transactions ..." history, then a "TOTAL" row that is
 *   ONLY the sell-transactions total — never use it as the headline total.
 * - Side panel: cash/weights on the first holdings row, cols M/N/O;
 *   profit-dashboard labels in col M with values in col N;
 *   "Total Amount" label in col I, USD value in col K (col J is SGD).
 * Returns JSON: { tiger: { rows, totals }, ibkr: { rows, totals }, snapshotLabel, asOf }
 */
var SHEET_ID = '1aBArvu654WCjovWxIcrjLCfEg07KFt9Z324Xc4jQJys';
var TIGER_TAB = 'Tiger - US Markets';
var IBKR_TAB = 'IBKR - US Markets';

function doGet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var out = {
    tiger: readBroker(ss, TIGER_TAB, true),
    ibkr: readBroker(ss, IBKR_TAB, false),
    snapshotLabel: 'Snapshot as on ' + snapshotLabel(),
    asOf: Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd')
  };
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Reads one broker tab. Columns (0-based): 0 Ticker, 1 Price, 2 Shares,
 * 3 Invested, 4 Unrealised, 5 Realised, 6 Weight%.
 * Holdings = rows up to the main totals row (blank ticker, invested > 0).
 * Everything below it is sell-transaction history and is NOT read.
 */
function readBroker(ss, tabName, isTiger) {
  var sheet = ss.getSheetByName(tabName);
  var values = sheet.getDataRange().getValues();
  var rows = [];
  var totals = null;
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var ticker = String(r[0] || '').trim();
    // Main totals row: blank ticker, invested/unrealised/realised in D/E/F.
    // Capture it and stop — below it is only sell-transaction history.
    if (!ticker && num(r[3]) > 0) {
      totals = {
        invested: num(r[3]), unrealised: num(r[4]), realised: num(r[5]),
        totalWithProfit: 0, cash: 0, cashPct: 0, equityPct: 0, contributed: 0,
        contributedLabel: isTiger ? 'Total contributed' : 'Total amount'
      };
      break;
    }
    if (!ticker) continue;
    // Section headers, never holdings.
    if (/transactions/i.test(ticker)) continue;
    if (/US Markets$/.test(ticker)) continue;
    if (/^total$/i.test(ticker)) continue;
    rows.push({
      ticker: ticker,
      price: r[1] === 'NA' || r[1] === null || r[1] === '' ? 'NA' : String(r[1]),
      shares: num(r[2]),
      invested: num(r[3]),
      unrealised: num(r[4]),
      realised: num(r[5]),
      weight: num(r[6])
    });
  }
  if (!totals) totals = sumTotals(rows);
  var side = readSideTotals(ss, tabName, isTiger);
  totals.cash = side.cash; totals.cashPct = side.cashPct; totals.equityPct = side.equityPct;
  totals.contributed = side.contributed;
  totals.expenses = side.expenses || 0;
  // Total With Profit as the sheet defines it: invested + unrealised + cash
  // + expenses. Prefer the sheet's own "Total With Profit (USD)" label; if
  // it is missing, compute it from the live figures — never a typed-in number.
  totals.totalWithProfit = side.totalWithProfit ||
    round2(totals.invested + totals.unrealised + side.cash + (side.expenses || 0));
  return { rows: rows, totals: totals };
}

function readSideTotals(ss, tabName, isTiger) {
  var values = ss.getSheetByName(tabName).getDataRange().getValues();
  // Cash and weights sit on the first holdings row, cols M/N/O (12/13/14);
  // the M/N/O values there are fractions (0.0489 = 4.89%).
  var out = {
    cash: num(values[1][12]),
    cashPct: round2(num(values[1][13]) * 100),
    equityPct: round2(num(values[1][14]) * 100),
    // Defaults are 0 — the loop below fills contributed/expenses from the
    // sheet's own labels ("Total Amount" / "Investment Amount (USD)" /
    // "Total Expenses / Distribution (USD)"). No typed-in amounts here.
    contributed: 0,
    expenses: 0,
    totalWithProfit: 0
  };
  for (var i = 0; i < values.length; i++) {
    // Profit-dashboard labels in col M (12), values in col N (13).
    var labelM = String(values[i][12] || '').trim();
    if (labelM === 'Total With Profit (USD)') out.totalWithProfit = num(values[i][13]);
    if (labelM === 'Total Expenses / Distribution (USD)') out.expenses = num(values[i][13]);
    if (labelM === 'Investment Amount (USD)') out.contributed = num(values[i][13]);
    // "Total Amount" label in col I (8): col J (9) is SGD, col K (10) is USD.
    var labelI = String(values[i][8] || '').trim();
    if (labelI === 'Total Amount') out.contributed = num(values[i][10]);
  }
  return out;
}

function snapshotLabel() {
  var now = new Date();
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Label uses the last US trading close (yesterday in SGT, or Friday if today is Monday).
  var d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (now.getDay() === 1) d = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() + ' close';
}

function sumTotals(rows) {
  var t = { invested: 0, unrealised: 0, realised: 0, totalWithProfit: 0, cash: 0, cashPct: 0, equityPct: 0, contributed: 0, contributedLabel: 'Total contributed' };
  rows.forEach(function (r) { t.invested += r.invested; t.unrealised += r.unrealised; t.realised += r.realised; });
  return t;
}
function num(v) { var n = parseFloat(String(v).replace(/[$,%]/g, '')); return isNaN(n) ? 0 : n; }
function round2(n) { return Math.round(n * 100) / 100; }
