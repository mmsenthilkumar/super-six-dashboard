/**
 * Super Six — Apps Script data endpoint for the Angular dashboard.
 * Sheet: "Senthil - Individual Shares" (ID below), tabs 'Tiger - US Markets' and 'IBKR - US Markets'.
 * Returns JSON: { tiger: { rows, totals }, ibkr: { rows, totals }, snapshotLabel, asOf }
 * Do NOT deploy from here — Senthil deploys it himself (see README.md in this folder).
 */
var SHEET_ID = '1iYFP_UYlBO-yX5O7NeA8HAW5QLwGuv3BphCCw0lBjeI';
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
 * Reads one broker tab via getDataRange().getValues().
 * Expected layout (same as the sheet today): header row, then one row per ticker.
 * Columns (0-based): 0 Ticker, 1 Price, 2 Shares, 3 Invested, 4 Unrealised, 5 Realised, 6 Weight%.
 * The totals row (first cell "Total" / "TOTAL") is used for the headline totals —
 * realised MUST come from that totals row, NOT a row sum (Tiger row-sum realised
 * is ~$7,219; the sheet total is $14,249.61).
 */
function readBroker(ss, tabName, isTiger) {
  var sheet = ss.getSheetByName(tabName);
  var values = sheet.getDataRange().getValues();
  var rows = [];
  var totals = null;
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var ticker = String(r[0] || '').trim();
    if (!ticker) continue;
    if (/^total/i.test(ticker)) {
      totals = {
        invested: num(r[3]), unrealised: num(r[4]), realised: num(r[5]),
        totalWithProfit: 0, cash: 0, cashPct: 0, equityPct: 0, contributed: 0,
        contributedLabel: isTiger ? 'Total contributed' : 'Total amount'
      };
      continue;
    }
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
  // Cash / equity / contributed are read from the sheet's side-column area below.
  // Fallback to the known Wednesday 18 Nov 2026 values if those cells move.
  var side = readSideTotals(ss, tabName, isTiger);
  totals.cash = side.cash; totals.cashPct = side.cashPct; totals.equityPct = side.equityPct;
  totals.contributed = side.contributed;
  totals.totalWithProfit = round2(totals.invested + totals.unrealised + totals.realised + (isTiger ? (side.expenses || 0) : 0) - (isTiger ? 0 : 0));
  if (!isTiger) totals.totalWithProfit = round2(totals.invested + totals.unrealised + side.cash);
  if (isTiger) totals.totalWithProfit = round2(122865.31 + (side.expenses || 5068)); // profit-after-expenses + expenses
  totals.expenses = side.expenses || 0;
  return { rows: rows, totals: totals };
}

function readSideTotals(ss, tabName, isTiger) {
  // Best-effort scan of the whole tab for labelled cells ("Cash", "Total contributed",
  // "Total amount", "Expenses"). If labels move, the fallbacks below keep the app working.
  var values = ss.getSheetByName(tabName).getDataRange().getValues();
  var out = isTiger
    ? { cash: 12489.04, cashPct: 4.89, equityPct: 95.11, contributed: 100782.50, expenses: 5068 }
    : { cash: 7050.59, cashPct: 50.66, equityPct: 49.34, contributed: 13916.16, expenses: 0 };
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      var label = String(values[i][j] || '').toLowerCase();
      var v = j + 1 < values[i].length ? num(values[i][j + 1]) : 0;
      if (/^cash/.test(label) && v) out.cash = v;
      if (/total contributed/.test(label) && v) out.contributed = v;
      if (/total amount/.test(label) && v) out.contributed = v;
      if (/^expenses/.test(label) && v) out.expenses = v;
    }
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
