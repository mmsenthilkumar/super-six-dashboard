export type ViewTab = 'both' | 'tiger' | 'ibkr';
export type BrokerKey = 'tiger' | 'ibkr';

/** One row of the sheet: ticker, price (string — DRAM is "NA" in the sheet), shares, invested, unrealised, realised, weight %. */
export interface HoldingRow {
  ticker: string;
  price: string | number;
  shares: number;
  invested: number;
  unrealised: number;
  realised: number;
  weight: number;
}

export interface BrokerTotals {
  invested: number;
  unrealised: number;
  /** Sheet side-column total, NOT the row sum (Tiger row-sum realised is $7,219.19; sheet total is $14,249.61). */
  realised: number;
  /** Tiger: "Total with profit" $127,933.31. IBKR: account value $13,678.39. */
  totalWithProfit: number;
  cash: number;
  cashPct: number;
  equityPct: number;
  /** Tiger: total contributed $100,782.50. IBKR: total amount $13,916.16. */
  contributed: number;
  contributedLabel: string;
  expenses?: number;
  profitPct?: number;
}

export interface HighlightItem { ticker: string; label: string; value: number; }

export interface BrokerSnapshot {
  key: BrokerKey;
  name: string;
  tag: string;
  info: string;
  rows: HoldingRow[];
  totals: BrokerTotals;
  heldCount: number;
  closedCount: number;
  topHoldings: HighlightItem[];
  biggestMovers: HighlightItem[];
  /** IBKR only: account-notes lines. */
  notes?: string[];
  noteInfo?: string;
}

export interface ChallengeMeta {
  groupName: string;
  title: string;
  period: string;
  target: number;
  monthCurrent: number;
  monthTotal: number;
  combined: number;
  combinedPct: number;
  remaining: number;
  invested: number;
  unrealised: number;
  realised: number;
}

export interface PortfolioData {
  tiger: BrokerSnapshot;
  ibkr: BrokerSnapshot;
  challenge: ChallengeMeta;
  snapshotLabel: string;
  asOf: string;
}

/** Shape returned by the Apps Script web app (docs/apps-script/Code.gs). */
export interface PortfolioResponse {
  tiger: { rows: HoldingRow[]; totals: BrokerTotals };
  ibkr: { rows: HoldingRow[]; totals: BrokerTotals };
  snapshotLabel: string;
  asOf: string;
  challenge?: Partial<ChallengeMeta>;
}
