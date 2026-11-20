import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription, catchError, interval, of, timeout } from 'rxjs';
import type { BrokerSnapshot, BrokerTotals, ChallengeMeta, HoldingRow, PortfolioData, PortfolioResponse } from '../models/portfolio.models';

/**
 * Data URL for live holdings from the Google Sheet (Apps Script web app).
 * Deployed 19 Nov 2026 — see docs/apps-script/Code.gs + README.md for the
 * deploy steps. The app has NO hardcoded holdings data: on load it fetches
 * this URL, and if the fetch fails the page stays empty (no stale snapshot
 * is shown — that behaviour was removed 20 Nov 2026 at Senthil's direction).
 */
export const APPS_SCRIPT_DATA_URL = 'https://script.google.com/macros/s/AKfycbxhKB-dXE0-HiDGe2xQUkIiiUTd1QIWMa43qoZBLRMe5XopKTHFiykB0LRXiQmXjMp6Mg/exec';

/** Auto-refresh interval: fetch on load, then every 15 minutes. */
export const AUTO_REFRESH_MS = 15 * 60 * 1000;

/**
 * App version, shown in the footer (e.g. "v1.0.0") so it is visible which
 * build is running. Bump on each release. History: 1.0.0 first Angular
 * deploy (19 Nov 2026), 1.0.1 smart refresh, 1.0.2 app icon in page,
 * 1.0.3 icon inlined + title wrap, 1.0.4 pull-to-refresh — then RESET to
 * 1.0.0 on 20 Nov 2026 at Senthil's direction, clean slate from here.
 * 1.0.1 pull-to-refresh scroll fix, 1.0.2 live milestone graph + brighter
 * colours, 1.0.3 overscroll-behavior removal, 1.0.4 (never deployed —
 * push declined) show % P/L in ticker rows, 1.0.5 same % P/L change +
 * closed positions removed from the list itself, 1.0.6 hardcoded
 * snapshot dropped, empty page on refresh failure, 1.0.7 redeployed
 * Apps Script URL + weight normalisation (see below), 1.0.8 branded
 * intro/loading page (logo, S6D, animated ring + dots). The update check
 * itself still compares the main-*.js
 * hash — that is automatic and cannot be forgotten; the version number
 * is for humans to track. (The page itself stays "Super Six"; S6D is
 * the Android app's name.)
 */
export const APP_VERSION = '1.0.8';

export type DataSource = 'loading' | 'live' | 'error';

/**
 * Challenge facts — config, not portfolio data. The challenge runs
 * Sep 2026 – Dec 2034 (100 months) toward $1,000,000. monthCurrent is
 * derived from the data's asOf date (Sep 2026 = month 1), never typed in.
 */
const CHALLENGE = {
  groupName: 'Super Six Investment Group',
  title: '100 Month – 1 Million Portfolio Challenge',
  period: 'Sep 2026 – Dec 2034',
  target: 1_000_000,
  monthTotal: 100,
  startYear: 2026,
  startMonth: 9, // September
} as const;

/** Challenge month (1-based) for a yyyy-MM-dd date; Sep 2026 = month 1. */
function monthCurrent(asOf: string): number {
  const m = asOf.match(/^(\d{4})-(\d{2})-\d{2}$/);
  const y = m ? +m[1] : new Date().getFullYear();
  const mo = m ? +m[2] : new Date().getMonth() + 1;
  return Math.max(1, (y - CHALLENGE.startYear) * 12 + (mo - CHALLENGE.startMonth) + 1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build one broker's snapshot from LIVE response data only. Closed /
 * zero-share positions are REMOVED from the list itself here (not merely
 * hidden at display): the rows the app holds contain only open positions.
 * Their realised P/L stays counted — totals come from the sheet totals
 * row, not from these rows. held/closed counts still describe the source
 * data, so the removal stays visible in the numbers.
 */
function buildSnapshot(
  key: 'tiger' | 'ibkr',
  name: string,
  tag: string,
  info: string,
  allRows: HoldingRow[],
  totalsIn: BrokerTotals,
  notes?: string[],
  noteInfo?: string,
): BrokerSnapshot {
  // Weights arrive from the sheet as FRACTIONS (AVGO 0.0887 = 8.87%) while
  // the app displays them as percents — since live data went on, "Top
  // holdings" showed them 100x too small (0.09% instead of 8.87%).
  // Normalise: if the largest weight is under 1, the column is fractional.
  const maxWeight = Math.max(0, ...allRows.map((r) => r.weight));
  const rows = maxWeight > 0 && maxWeight < 1
    ? allRows.map((r) => ({ ...r, weight: r.weight * 100 }))
    : allRows;
  const open = rows.filter((r) => r.shares > 0);
  const totals: BrokerTotals = {
    ...totalsIn,
    // Profit on contributed: (unrealised + realised) ÷ contributed.
    // The Apps Script does not return this; it is computed live here.
    profitPct: totalsIn.contributed
      ? round2(((totalsIn.unrealised + totalsIn.realised) / totalsIn.contributed) * 100)
      : 0,
  };
  return {
    key,
    name,
    tag,
    info,
    rows: open,
    totals,
    heldCount: open.length,
    closedCount: allRows.filter((r) => r.shares === 0).length,
    topHoldings: [...open]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((r) => ({ ticker: r.ticker, label: `${r.weight.toFixed(2)}% · ${r.unrealised >= 0 ? '+' : '−'}$${Math.abs(Math.round(r.unrealised)).toLocaleString()}`, value: r.unrealised })),
    biggestMovers: [...open]
      .sort((a, b) => Math.abs(b.unrealised) - Math.abs(a.unrealised))
      .slice(0, 7)
      .map((r) => ({ ticker: r.ticker, label: `${r.unrealised >= 0 ? '+' : '−'}$${Math.abs(Math.round(r.unrealised)).toLocaleString()}`, value: r.unrealised })),
    notes,
    noteInfo,
  };
}

function snapshotFromResponse(res: PortfolioResponse): PortfolioData {
  const tigerRows = res.tiger.rows;
  const ibkrRows = res.ibkr.rows;
  const tigerOpen = tigerRows.filter((r) => r.shares > 0);
  const ibkrOpen = ibkrRows.filter((r) => r.shares > 0);
  const tiger = buildSnapshot(
    'tiger',
    'Tiger — US Markets (USD)',
    'Tiger — US Markets (USD)',
    `${tigerOpen.length} tickers currently held. Closed / zero-share positions are not listed; their realised P/L stays in the totals. All amounts in USD.`,
    tigerRows,
    res.tiger.totals,
  );
  // IBKR account notes, all derived from the live rows/totals.
  const ibkrNotes = res.ibkr.totals.cashPct >= 40 ? ['Half the account is still cash'] : [];
  const nvdaIbkr = ibkrRows.find((r) => r.ticker === 'NVDA');
  const nvdaTigerClosed = tigerRows.find((r) => r.ticker === 'NVDA' && r.shares === 0);
  const onlyProfit = ibkrOpen.filter((r) => r.unrealised > 0);
  const ibkrNoteInfo = [
    res.ibkr.totals.cashPct >= 40 ? 'Half the account is still cash, waiting to be deployed.' : '',
    nvdaIbkr && nvdaTigerClosed
      ? `NVDA is still held here — it was fully sold in Tiger, realising +$${Math.round(nvdaTigerClosed.realised).toLocaleString()} there.`
      : '',
    onlyProfit.length === 1 ? `${onlyProfit[0].ticker} is the only IBKR holding currently in profit.` : '',
  ].filter(Boolean).join(' ') || undefined;
  const ibkr = buildSnapshot(
    'ibkr',
    'IBKR — US Markets (USD)',
    'IBKR — US Markets (USD)',
    `${ibkrOpen.length} tickers, all currently held. Account opened Sep – Nov 2026. All amounts in USD.`,
    ibkrRows,
    res.ibkr.totals,
    ibkrNotes,
    ibkrNoteInfo,
  );
  const combined = Math.round(tiger.totals.totalWithProfit + ibkr.totals.totalWithProfit);
  const challenge: ChallengeMeta = {
    groupName: CHALLENGE.groupName,
    title: CHALLENGE.title,
    period: CHALLENGE.period,
    target: CHALLENGE.target,
    monthCurrent: monthCurrent(res.asOf || ''),
    monthTotal: CHALLENGE.monthTotal,
    combined,
    combinedPct: +(combined / CHALLENGE.target * 100).toFixed(1),
    remaining: CHALLENGE.target - combined,
    invested: Math.round(tiger.totals.invested + ibkr.totals.invested),
    unrealised: Math.round((tiger.totals.unrealised + ibkr.totals.unrealised) * 100) / 100,
    realised: Math.round(tiger.totals.realised + ibkr.totals.realised),
  };
  return {
    tiger, ibkr,
    challenge,
    snapshotLabel: res.snapshotLabel || '',
    asOf: res.asOf || '',
  };
}

@Injectable({ providedIn: 'root' })
export class PortfolioDataService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  /** Current portfolio data — null until a live fetch succeeds. There is
   *  no fallback snapshot: if the fetch fails the page stays empty. */
  readonly data = signal<PortfolioData | null>(null);
  /** 'loading' until the first fetch settles, then 'live' or 'error'. */
  readonly source = signal<DataSource>('loading');
  readonly loading = signal(false);
  readonly lastUpdated = signal<Date | null>(null);
  readonly lastError = signal<string | null>(null);

  private autoRefreshSub: Subscription | null = null;

  /** Fetch holdings from the Apps Script endpoint. On ANY failure the
   *  page is left empty (data stays null) — stale numbers are never shown. */
  fetchFromSheet(dataUrl: string = APPS_SCRIPT_DATA_URL): void {
    if (!dataUrl) {
      this.data.set(null);
      this.source.set('error');
      this.lastError.set('No data source configured — the Apps Script URL is missing.');
      return;
    }
    this.loading.set(true);
    this.http
      .get<PortfolioResponse>(dataUrl, { params: { t: String(Date.now()) } })
      .pipe(
        timeout(15000),
        catchError((err) => {
          this.data.set(null);
          this.source.set('error');
          this.lastError.set(err?.message ?? String(err));
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (!res || !res.tiger?.rows || !res.ibkr?.rows) {
          this.data.set(null);
          this.source.set('error');
          this.lastError.set('Live data was empty or malformed — nothing shown.');
          return;
        }
        this.data.set(snapshotFromResponse(res));
        this.source.set('live');
        this.lastError.set(null);
        this.lastUpdated.set(new Date());
      });
  }

  /**
   * Manual refresh (the refresh icon button). Hybrid: always re-fetches the
   * sheet data (fast, keeps the current tab, scroll position and text size,
   * no re-login risk), and only reloads the page when a NEW BUILD exists.
   * A plain data refresh can never show a new deploy; a reload on every tap
   * resets the tab/font/scroll and can drop the user at the Access sign-in
   * if the 24-hour session expired. So: data first, then check the deployed
   * index.html for a different main-*.js hash, and reload (cache-busting)
   * only when one is found. Auto-refresh (15 min) stays data-only.
   */
  refresh(): void {
    this.fetchFromSheet();
    if (!this.isBrowser) return;
    void this.checkForUpdate().then((hasUpdate) => {
      if (hasUpdate && typeof window !== 'undefined') {
        window.location.href = window.location.pathname + '?v=' + Date.now();
      }
    });
  }

  /** True when the deployed index.html references a different main-*.js
   *  bundle than the one this page loaded — i.e. a new version is live. */
  private async checkForUpdate(): Promise<boolean> {
    try {
      const loaded = this.loadedMainHash();
      if (!loaded || typeof fetch === 'undefined') return false;
      const res = await fetch('/?v=' + Date.now(), { cache: 'no-store' });
      const html = await res.text();
      const deployed = html.match(/main-([A-Z0-9]+)\.js/)?.[1] ?? null;
      return !!deployed && deployed !== loaded;
    } catch {
      return false;
    }
  }

  /** Hash of the main-*.js bundle this page actually loaded. */
  private loadedMainHash(): string | null {
    if (typeof document === 'undefined') return null;
    const src = document.querySelector('script[src*="main-"]')?.getAttribute('src') ?? '';
    return src.match(/main-([A-Z0-9]+)\.js/)?.[1] ?? null;
  }

  /**
   * Start the 15-minute auto-refresh timer: fetch on load, then every 15 min.
   * Safe to call from a component's ngOnInit (browser only — no timer on the server, so SSR/build is unaffected).
   * Call stopAutoRefresh() in ngOnDestroy.
   */
  startAutoRefresh(intervalMs: number = AUTO_REFRESH_MS): void {
    this.stopAutoRefresh();
    this.fetchFromSheet();
    if (!this.isBrowser) return;
    this.autoRefreshSub = interval(intervalMs).subscribe(() => this.fetchFromSheet());
  }

  stopAutoRefresh(): void {
    this.autoRefreshSub?.unsubscribe();
    this.autoRefreshSub = null;
  }

  // --- Derived helpers (used by the combined overview) ---
  combinedValue(d: PortfolioData): number {
    return Math.round(d.tiger.totals.totalWithProfit + d.ibkr.totals.totalWithProfit);
  }
  sortedRows(rows: HoldingRow[], sort: string): HoldingRow[] {
    const list = [...rows];
    switch (sort) {
      case 'weight': return list.sort((a, b) => b.weight - a.weight);
      case 'unreal': return list.sort((a, b) => b.unrealised - a.unrealised);
      case 'unrealAsc': return list.sort((a, b) => a.unrealised - b.unrealised);
      case 'invested': return list.sort((a, b) => b.invested - a.invested);
      default: return list.sort((a, b) => a.ticker.localeCompare(b.ticker));
    }
  }
  filterByChips(rows: HoldingRow[], chips: string[]): HoldingRow[] {
    if (!chips.length) return rows;
    return rows.filter((r) => chips.includes(r.ticker.toUpperCase()));
  }
}
