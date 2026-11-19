import { Component, Input, inject } from '@angular/core';
import { InfoPopoverComponent } from '../../shared/components/info-popover/info-popover.component';
import { StatGridComponent, type StatItem } from '../../shared/components/stat-grid/stat-grid.component';
import { EquityCashSplitComponent } from '../../shared/components/equity-cash-split/equity-cash-split.component';
import { TickerFilterBarComponent, type SortKey } from '../../shared/components/ticker-filter-bar/ticker-filter-bar.component';
import { PortfolioFormatPipe } from '../../shared/pipes/portfolio-format.pipe';
import { PortfolioDataService } from '../../core/services/portfolio-data.service';
import type { BrokerSnapshot, HoldingRow } from '../../core/models/portfolio.models';

/**
 * Reusable Tiger / IBKR section: logo toggle (show/hide stock list, shown by default),
 * multi-chip search + sort, holdings table (cards on mobile), equity/cash split always
 * visible below the list, 4-box summary, top holdings / biggest movers at the end.
 */
@Component({
  selector: 'app-broker-section',
  standalone: true,
  imports: [InfoPopoverComponent, StatGridComponent, EquityCashSplitComponent, TickerFilterBarComponent, PortfolioFormatPipe],
  templateUrl: './broker-section.component.html',
  styleUrl: './broker-section.component.scss',
})
export class BrokerSectionComponent {
  @Input({ required: true }) snapshot!: BrokerSnapshot;
  protected dataSvc = inject(PortfolioDataService);
  protected showHoldings = true;
  protected chips: string[] = [];
  protected sort: SortKey = 'ticker';
  private fmt = new PortfolioFormatPipe();

  protected get visibleRows(): HoldingRow[] {
    // No closed-row filter here: closed positions are removed from the list
    // itself when the data loads (portfolio-data.service), so this list
    // only ever holds open positions.
    const filtered = this.dataSvc.filterByChips(this.snapshot.rows, this.chips);
    return this.dataSvc.sortedRows(filtered, this.sort);
  }
  protected unrealPct(row: HoldingRow): string {
    if (!row.invested) return '—';
    const pct = (row.unrealised / row.invested) * 100;
    return (pct >= 0 ? '+' : '−') + Math.abs(pct).toFixed(2) + '%';
  }
  protected rowClass(row: HoldingRow): string {
    if (row.shares === 0) return 'zero';
    if (row.unrealised > 0) return 'gain';
    if (row.unrealised < 0) return 'loss';
    return 'flat';
  }
  protected get stats(): StatItem[] {
    // Every number here is computed live from the totals — no hardcoded
    // percentages or amounts. Bars show each figure as % of contributed
    // (Tiger) / total amount (IBKR), capped at 100.
    const t = this.snapshot.totals;
    const isTiger = this.snapshot.key === 'tiger';
    const base = t.contributed || 0;
    const pctOf = (v: number): number => (base ? (v / base) * 100 : 0);
    const signed = (pct: number): string => (pct >= 0 ? '+' : '−') + Math.abs(pct).toFixed(2) + '%';
    const bar = (v: number): number => Math.max(0, Math.min(100, Math.abs(pctOf(v))));
    const signClass = (v: number): 'pos' | 'neg' => (v >= 0 ? 'pos' : 'neg');
    const contributedLabel = isTiger ? 'contributed' : 'total amount';
    if (isTiger) {
      const profitPct = t.profitPct ?? pctOf(t.unrealised + t.realised);
      return [
        { label: 'Invested', value: this.fmt.transform(t.invested, 'usd'), barPct: bar(t.invested), barColor: 'var(--tiger)', graphLabel: `${pctOf(t.invested).toFixed(1)}% of contributed`, sub: `Total contributed ${this.fmt.transform(t.contributed, 'usd')}` },
        { label: 'Unrealised', value: this.fmt.transform(t.unrealised, 'signed'), valueClass: signClass(t.unrealised), barPct: bar(t.unrealised), barColor: 'var(--green)', graphLabel: `${signed(pctOf(t.unrealised))} of contributed`, graphLabelClass: signClass(t.unrealised), sub: `${signed(pctOf(t.unrealised))} of total contributed`, subClass: signClass(t.unrealised) },
        { label: 'Realised', value: this.fmt.transform(t.realised, 'signed'), valueClass: signClass(t.realised), barPct: bar(t.realised), barColor: 'var(--green)', graphLabel: `${signed(pctOf(t.realised))} of contributed`, graphLabelClass: signClass(t.realised), sub: `${signed(pctOf(t.realised))} of total contributed`, subClass: signClass(t.realised) },
        { label: 'Total with profit', value: this.fmt.transform(t.totalWithProfit, 'usd'), barPct: bar(t.totalWithProfit), barColor: 'var(--gold)', graphLabel: `${signed(profitPct)} on contributed`, graphLabelClass: signClass(profitPct), sub: `${signed(profitPct)} on total contributed, before expenses`, subClass: signClass(profitPct) },
      ];
    }
    const equity = t.invested + t.unrealised;
    return [
      { label: 'Invested', value: this.fmt.transform(t.invested, 'usd'), barPct: bar(t.invested), barColor: 'var(--ibkr)', graphLabel: `${pctOf(t.invested).toFixed(1)}% of total amount`, sub: `of ${this.fmt.transform(t.contributed, 'usd')} total amount` },
      { label: 'Unrealised', value: this.fmt.transform(t.unrealised, 'signed'), valueClass: signClass(t.unrealised), barPct: bar(t.unrealised), barColor: 'var(--red)', graphLabel: `${signed(pctOf(t.unrealised))} of total amount`, graphLabelClass: signClass(t.unrealised), sub: `${signed(pctOf(t.unrealised))} of total amount`, subClass: signClass(t.unrealised) },
      { label: 'Realised', value: this.fmt.transform(t.realised, 'usd'), valueClass: t.realised === 0 ? undefined : signClass(t.realised), barPct: bar(t.realised), barColor: t.realised === 0 ? 'var(--muted)' : 'var(--green)', graphLabel: t.realised === 0 ? 'No sales yet' : `${signed(pctOf(t.realised))} of total amount`, sub: t.realised === 0 ? 'No sales yet' : `${signed(pctOf(t.realised))} of total amount` },
      { label: 'Account value', value: this.fmt.transform(t.totalWithProfit, 'usd'), barPct: bar(t.totalWithProfit), barColor: 'var(--ibkr)', graphLabel: 'Equity + cash', sub: `Equity ${this.fmt.transform(equity, 'usd')} + cash ${this.fmt.transform(t.cash, 'usd')}` },
    ];
  }
}
