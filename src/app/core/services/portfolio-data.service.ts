import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription, catchError, interval, of, timeout } from 'rxjs';
import type { BrokerSnapshot, HoldingRow, PortfolioData, PortfolioResponse } from '../models/portfolio.models';

/**
 * Data URL for live holdings from the Google Sheet.
 *
 * HOW TO ENABLE LIVE DATA (do this once the Apps Script is deployed):
 *   1. In the sheet: Extensions → Apps Script → paste docs/apps-script/Code.gs
 *      → Deploy → New deployment → Web app, Execute as Me, Access: Anyone.
 *   2. Copy the /exec URL and paste it here as APPS_SCRIPT_DATA_URL.
 *   3. Rebuild + redeploy the Angular app.
 * Leave it as '' (empty) and the app uses the static Wednesday 18 Nov 2026
 * snapshot embedded below — the app works fully offline / before deployment.
 */
export const APPS_SCRIPT_DATA_URL = 'https://script.google.com/macros/s/AKfycbzjC2l9y3_2JkWgzhnrY9y_0Z88Fl2XrqmhEiY-fs0XCP9FkadYrP4OpctqLiztHjOvwA/exec';

/** Auto-refresh interval: fetch on load, then every 15 minutes. */
export const AUTO_REFRESH_MS = 15 * 60 * 1000;

/**
 * App version, shown in the footer (e.g. "v1.0.0") so it is visible which
 * build is running. Bump on each release. History: 1.0.0 first Angular
 * deploy (19 Nov 2026), 1.0.1 smart refresh, 1.0.2 app icon in page,
 * 1.0.3 icon inlined + title wrap, 1.0.4 pull-to-refresh — then RESET to
 * 1.0.0 on 20 Nov 2026 at Senthil's direction, clean slate from here.
 * The update check itself still compares the main-*.js hash — that is
 * automatic and cannot be forgotten; the version number is for humans
 * to track. (The page itself stays "Super Six"; S6D is the Android
 * app's name.)
 */
export const APP_VERSION = '1.0.5';

export type DataSource = 'static' | 'live' | 'live-fallback';

const TIGER_ROWS: HoldingRow[] = [
    { ticker: 'AAPL', price: '352.45', shares: 3, invested: 1006.58, unrealised: 50.77, realised: 0, weight: 0.88 },
    { ticker: 'AMD', price: '530.14', shares: 8, invested: 1160.36, unrealised: 3080.76, realised: 0, weight: 1.01 },
    { ticker: 'AMZN', price: '267.74', shares: 10, invested: 2254.2, unrealised: 423.2, realised: 0, weight: 2.24 },
    { ticker: 'APP', price: '390.91', shares: 2, invested: 951.18, unrealised: -169.36, realised: 0, weight: 0.94 },
    { ticker: 'ARM', price: '182.76', shares: 15, invested: 1893.07, unrealised: 848.33, realised: 232.09, weight: 1.88 },
    { ticker: 'ASML', price: '1395.27', shares: 2, invested: 1682.84, unrealised: 1107.7, realised: 0, weight: 1.67 },
    { ticker: 'AVGO', price: '354.05', shares: 40, invested: 8943.25, unrealised: 5218.75, realised: 0, weight: 8.87 },
    { ticker: 'AXON', price: '300.69', shares: 1, invested: 788.07, unrealised: -487.38, realised: 0, weight: 0.78 },
    { ticker: 'BABA', price: '84.37', shares: 8, invested: 1286.2, unrealised: -611.24, realised: 0, weight: 1.28 },
    { ticker: 'BE', price: '170.98', shares: 2, invested: 543.18, unrealised: -201.22, realised: 0, weight: 0.54 },
    { ticker: 'CAT', price: '558.77', shares: 4, invested: 2227.96, unrealised: 7.12, realised: 0, weight: 2.21 },
    { ticker: 'CBRS', price: '94.15', shares: 2, invested: 490.18, unrealised: -301.88, realised: 0, weight: 0.49 },
    { ticker: 'CEG', price: '262.74', shares: 4, invested: 1226.78, unrealised: -175.82, realised: 0, weight: 1.22 },
    { ticker: 'CRCL', price: '53.31', shares: 4, invested: 515.6, unrealised: -302.36, realised: 0, weight: 0.51 },
    { ticker: 'CRWD', price: '237.03', shares: 15, invested: 1523.83, unrealised: 2031.62, realised: 0, weight: 1.51 },
    { ticker: 'CRWV', price: '47.83', shares: 3, invested: 434.78, unrealised: -291.29, realised: 0, weight: 0.4 },
    { ticker: 'DELL', price: '313.11', shares: 12, invested: 1612.6, unrealised: 2144.72, realised: 0, weight: 1.4 },
    { ticker: 'DKNG', price: '17.92', shares: 15, invested: 304.4, unrealised: -35.6, realised: 0, weight: 0.26 },
    { ticker: 'DRAM', price: 'NA', shares: 20, invested: 1234.4, unrealised: -55.0, realised: 0, weight: 1.22 },
    { ticker: 'EXPE', price: '245.79', shares: 0, invested: 0, unrealised: 0, realised: 179.51, weight: 0 },
    { ticker: 'FCX', price: '51.45', shares: 0, invested: 0, unrealised: 0, realised: 218.65, weight: 0 },
    { ticker: 'FISV', price: '53', shares: 10, invested: 670.2, unrealised: -140.2, realised: 0, weight: 0.66 },
    { ticker: 'FIX', price: '1140.59', shares: 1, invested: 1440.17, unrealised: -299.58, realised: 0, weight: 1.43 },
    { ticker: 'GEV', price: '772.22', shares: 6, invested: 3984.56, unrealised: 648.76, realised: 0, weight: 3.95 },
    { ticker: 'GLW', price: '108.15', shares: 15, invested: 2191.48, unrealised: -569.23, realised: 0, weight: 2.17 },
    { ticker: 'GOOG', price: '279.20', shares: 20, invested: 5933.57, unrealised: -349.57, realised: 0, weight: 5.89 },
    { ticker: 'GS', price: '873.18', shares: 12, invested: 6933.2, unrealised: 3544.96, realised: 0, weight: 6.88 },
    { ticker: 'HOG', price: '33.34', shares: 10, invested: 267.9, unrealised: 65.5, realised: 0, weight: 0.27 },
    { ticker: 'IJR', price: '137.9', shares: 0, invested: 0, unrealised: 0, realised: 19.27, weight: 0 },
    { ticker: 'IONQ', price: '23.48', shares: 10, invested: 575.6, unrealised: -340.8, realised: 0, weight: 0.57 },
    { ticker: 'IREN', price: '15.24', shares: 10, invested: 587.2, unrealised: -434.8, realised: 0, weight: 0.58 },
    { ticker: 'ITB', price: '92.66', shares: 6, invested: 643.0, unrealised: -87.04, realised: 0, weight: 0.64 },
    { ticker: 'JPM', price: '324.11', shares: 2, invested: 668.8, unrealised: -20.58, realised: 0, weight: 0.66 },
    { ticker: 'KRE', price: '70.52', shares: 8, invested: 519.79, unrealised: 44.37, realised: 0, weight: 0.52 },
    { ticker: 'LHX', price: '256.36', shares: 4, invested: 1472.2, unrealised: -446.76, realised: 0, weight: 1.46 },
    { ticker: 'LITE', price: '551.07', shares: 1, invested: 1054.4, unrealised: -503.33, realised: 0, weight: 1.05 },
    { ticker: 'LRCX', price: '211.67', shares: 0, invested: 0, unrealised: 0, realised: 1.3, weight: 0 },
    { ticker: 'META', price: '616.38', shares: 5, invested: 3222.36, unrealised: -140.46, realised: 0, weight: 3.2 },
    { ticker: 'MP', price: '35.95', shares: 0, invested: 0, unrealised: 0, realised: 187.08, weight: 0 },
    { ticker: 'MU', price: '705.27', shares: 5, invested: 2076.85, unrealised: 1449.5, realised: 0, weight: 1.81 },
    { ticker: 'NKE', price: '36.31', shares: 10, invested: 637.2, unrealised: -274.1, realised: 0, weight: 0.63 },
    { ticker: 'NFLX', price: '59.82', shares: 15, invested: 1035.66, unrealised: -138.36, realised: 0, weight: 1.03 },
    { ticker: 'NOW', price: '90.59', shares: 25, invested: 2551.6, unrealised: -286.85, realised: 0, weight: 2.53 },
    { ticker: 'NVDA', price: '150.96', shares: 0, invested: 0, unrealised: 0, realised: 6250.06, weight: 0 },
    { ticker: 'NXT', price: '114', shares: 4, invested: 197.78, unrealised: 258.22, realised: 0, weight: 0.2 },
    { ticker: 'ORCL', price: '113.89', shares: 20, invested: 3684.43, unrealised: -1406.63, realised: 0, weight: 3.65 },
    { ticker: 'PLTR', price: '156.67', shares: 5, invested: 339.69, unrealised: 443.66, realised: 0, weight: 0.34 },
    { ticker: 'PYPL', price: '57.89', shares: 10, invested: 794.2, unrealised: -215.3, realised: 0, weight: 0.69 },
    { ticker: 'Q', price: '115.82', shares: 8, invested: 1283.4, unrealised: -356.84, realised: 0, weight: 1.27 },
    { ticker: 'QTUM', price: '122.95', shares: 15, invested: 1728.87, unrealised: 115.38, realised: 0, weight: 1.5 },
    { ticker: 'RACE', price: '410.91', shares: 5, invested: 1868.96, unrealised: 185.59, realised: 0, weight: 1.62 },
    { ticker: 'RDDT', price: '94.09', shares: 4, invested: 250.0, unrealised: 126.36, realised: 0, weight: 0.25 },
    { ticker: 'RIVN', price: '11.8', shares: 15, invested: 302.39, unrealised: -125.39, realised: 0, weight: 0.3 },
    { ticker: 'SAP', price: '210.76', shares: 8, invested: 1427.0, unrealised: 259.08, realised: 0, weight: 1.41 },
    { ticker: 'SHAK', price: '74.45', shares: 3, invested: 367.28, unrealised: -143.93, realised: 0, weight: 0.36 },
    { ticker: 'SLB', price: '48.41', shares: 0, invested: 0, unrealised: 0, realised: 98.58, weight: 0 },
    { ticker: 'SOFI', price: '14.11', shares: 0, invested: 0, unrealised: 0, realised: 0, weight: 0 },
    { ticker: 'SPCX', price: '143.5', shares: 10, invested: 1538.38, unrealised: -103.38, realised: 0, weight: 1.52 },
    { ticker: 'TEM', price: '63.62', shares: 0, invested: 0, unrealised: 0, realised: 138.39, weight: 0 },
    { ticker: 'TMF', price: '28.23', shares: 70, invested: 3446.33, unrealised: -1470.23, realised: 0, weight: 3.42 },
    { ticker: 'TMUS', price: '164.02', shares: 6, invested: 912.19, unrealised: 71.93, realised: 0, weight: 0.9 },
    { ticker: 'TSLA', price: '383.72', shares: 10, invested: 2776.54, unrealised: 1060.66, realised: -122.69, weight: 2.74 },
    { ticker: 'TSM', price: '362.62', shares: 17, invested: 5433.53, unrealised: 731.01, realised: 0, weight: 5.36 },
    { ticker: 'VLO', price: '343.7', shares: 0, invested: 0, unrealised: 0, realised: 16.95, weight: 0 },
    { ticker: 'VST', price: '125.58', shares: 5, invested: 806.94, unrealised: -179.04, realised: 0, weight: 0.8 },
    { ticker: 'WMT', price: '127.36', shares: 16, invested: 2004.4, unrealised: 33.36, realised: 0, weight: 1.99 },
    { ticker: 'BTC', price: '27.62', shares: 50, invested: 1767.56, unrealised: -386.56, realised: 0, weight: 1.54 }
];

const IBKR_ROWS: HoldingRow[] = [
    { ticker: 'BRK.B', price: '574.62', shares: 2, invested: 1157.0, unrealised: -7.76, realised: 0, weight: 8.31 },
    { ticker: 'IGV', price: '96.94', shares: 20, invested: 2049.22, unrealised: -110.42, realised: 0, weight: 14.73 },
    { ticker: 'NVDA', price: '150.96', shares: 8, invested: 1280.0, unrealised: -72.32, realised: 0, weight: 9.2 },
    { ticker: 'PANW', price: '339.92', shares: 4, invested: 1356.0, unrealised: 3.68, realised: 0, weight: 9.74 },
    { ticker: 'VRT', price: '194.48', shares: 5, invested: 1023.35, unrealised: -50.95, realised: 0, weight: 7.35 }
];

export const STATIC_SNAPSHOT: PortfolioData = {
  tiger: {
    key: 'tiger',
    name: 'Tiger — US Markets (USD)',
    tag: 'Tiger — US Markets (USD)',
    info: '57 tickers currently held. Closed / zero-share positions are not listed; their realised P/L stays in the totals. All amounts in USD.',
    rows: TIGER_ROWS.filter((r) => r.shares > 0),
    totals: {
      invested: 97475.07, unrealised: 12901.2, realised: 14249.61,
      totalWithProfit: 127933.31, cash: 12489.04, cashPct: 4.89, equityPct: 95.11,
      contributed: 100782.5, contributedLabel: 'Total contributed', expenses: 5068, profitPct: 26.94,
    },
    heldCount: 57, closedCount: 10,
    topHoldings: [
      { ticker: 'AVGO', label: '8.87% · +$5,219', value: 5218.75 },
      { ticker: 'GS', label: '6.88% · +$3,545', value: 3544.96 },
      { ticker: 'GOOG', label: '5.89% · −$350', value: -349.57 },
      { ticker: 'TSM', label: '5.36% · +$731', value: 731.01 },
      { ticker: 'GEV', label: '3.95% · +$649', value: 648.76 },
    ],
    biggestMovers: [
      { ticker: 'AVGO', label: '+$5,219', value: 5218.75 },
      { ticker: 'GS', label: '+$3,545', value: 3544.96 },
      { ticker: 'AMD', label: '+$3,081', value: 3080.76 },
      { ticker: 'DELL', label: '+$2,145', value: 2144.72 },
      { ticker: 'CRWD', label: '+$2,032', value: 2031.62 },
      { ticker: 'TMF', label: '−$1,470', value: -1470.23 },
      { ticker: 'ORCL', label: '−$1,407', value: -1406.63 },
    ],
  },
  ibkr: {
    key: 'ibkr',
    name: 'IBKR — US Markets (USD)',
    tag: 'IBKR — US Markets (USD)',
    info: '5 tickers, all currently held. Account opened Sep – Nov 2026. All amounts in USD.',
    rows: IBKR_ROWS,
    totals: {
      invested: 6865.57, unrealised: -237.77, realised: 0,
      totalWithProfit: 13678.39, cash: 7050.59, cashPct: 50.66, equityPct: 49.34,
      contributed: 13916.16, contributedLabel: 'Total amount',
    },
    heldCount: 5, closedCount: 0,
    topHoldings: [
      { ticker: 'IGV', label: '14.73% · −$110', value: -110.42 },
      { ticker: 'PANW', label: '9.74% · +$4', value: 3.68 },
      { ticker: 'NVDA', label: '9.20% · −$72', value: -72.32 },
      { ticker: 'BRK.B', label: '8.31% · −$8', value: -7.76 },
      { ticker: 'VRT', label: '7.35% · −$51', value: -50.95 },
    ],
    biggestMovers: [],
    notes: ['Half the account is still cash'],
    noteInfo: 'Half the account is still cash, waiting to be deployed. NVDA is still held here — it was fully sold in Tiger, realising +$6,250 there. PANW is the only IBKR holding currently in profit.',
  },
  challenge: {
    groupName: 'Super Six Investment Group',
    title: '100 Month – 1 Million Portfolio Challenge',
    period: 'Sep 2026 – Dec 2034',
    target: 1000000,
    monthCurrent: 3, monthTotal: 100,
    combined: 141612, combinedPct: 14.2, remaining: 858388,
    invested: 104341, unrealised: 12663, realised: 14250,
  },
  snapshotLabel: 'Snapshot as on Wednesday, 18 Nov 2026 close',
  asOf: '2026-11-18',
};

function snapshotFromResponse(res: PortfolioResponse): PortfolioData {
  const base = STATIC_SNAPSHOT;
  // Closed / zero-share positions are REMOVED from the list itself here (not
  // merely hidden at display): the rows the app holds contain only open
  // positions. Their realised P/L stays counted — totals come from the
  // sheet totals row, not from these rows. held/closed counts still
  // describe the source data, so the removal stays visible in the numbers.
  const merge = (snap: BrokerSnapshot, part: { rows: HoldingRow[]; totals: any }): BrokerSnapshot => ({
    ...snap,
    rows: part.rows.filter((r) => r.shares > 0),
    totals: { ...snap.totals, ...part.totals },
    heldCount: part.rows.filter((r) => r.shares > 0).length,
    closedCount: part.rows.filter((r) => r.shares === 0).length,
    topHoldings: [...part.rows]
      .filter((r) => r.shares > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((r) => ({ ticker: r.ticker, label: `${r.weight.toFixed(2)}% · ${r.unrealised >= 0 ? '+' : '−'}$${Math.abs(Math.round(r.unrealised)).toLocaleString()}`, value: r.unrealised })),
    biggestMovers: [...part.rows]
      .filter((r) => r.shares > 0)
      .sort((a, b) => Math.abs(b.unrealised) - Math.abs(a.unrealised))
      .slice(0, 7)
      .map((r) => ({ ticker: r.ticker, label: `${r.unrealised >= 0 ? '+' : '−'}$${Math.abs(Math.round(r.unrealised)).toLocaleString()}`, value: r.unrealised })),
  });
  const tiger = merge(base.tiger, res.tiger);
  const ibkr = merge(base.ibkr, res.ibkr);
  const combined = Math.round(tiger.totals.totalWithProfit + ibkr.totals.totalWithProfit);
  return {
    tiger, ibkr,
    challenge: {
      ...base.challenge,
      ...(res.challenge ?? {}),
      combined,
      combinedPct: +(combined / base.challenge.target * 100).toFixed(1),
      remaining: base.challenge.target - combined,
      invested: Math.round(tiger.totals.invested + ibkr.totals.invested),
      unrealised: Math.round((tiger.totals.unrealised + ibkr.totals.unrealised) * 100) / 100,
      realised: Math.round(tiger.totals.realised + ibkr.totals.realised),
    },
    snapshotLabel: res.snapshotLabel || base.snapshotLabel,
    asOf: res.asOf || base.asOf,
  };
}

@Injectable({ providedIn: 'root' })
export class PortfolioDataService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  /** Current portfolio data (static snapshot until a live fetch succeeds). */
  readonly data = signal<PortfolioData>(STATIC_SNAPSHOT);
  /** Where the current data came from: 'static' (no URL configured), 'live', or 'live-fallback' (fetch failed). */
  readonly source = signal<DataSource>(APPS_SCRIPT_DATA_URL ? 'live-fallback' : 'static');
  readonly loading = signal(false);
  readonly lastUpdated = signal<Date | null>(null);
  readonly lastError = signal<string | null>(null);

  private autoRefreshSub: Subscription | null = null;

  /** Fetch holdings from the Apps Script endpoint; falls back to the static snapshot on any failure. */
  fetchFromSheet(dataUrl: string = APPS_SCRIPT_DATA_URL): void {
    if (!dataUrl) {
      this.data.set(STATIC_SNAPSHOT);
      this.source.set('static');
      this.lastUpdated.set(new Date());
      return;
    }
    this.loading.set(true);
    this.http
      .get<PortfolioResponse>(dataUrl, { params: { t: String(Date.now()) } })
      .pipe(
        timeout(15000),
        catchError((err) => {
          this.lastError.set(err?.message ?? String(err));
          this.source.set('live-fallback');
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (!res || !res.tiger?.rows || !res.ibkr?.rows) {
          this.lastError.set('Live data was empty or malformed — showing the static snapshot.');
          this.source.set('live-fallback');
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
  combinedValue(d: PortfolioData = this.data()): number {
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
