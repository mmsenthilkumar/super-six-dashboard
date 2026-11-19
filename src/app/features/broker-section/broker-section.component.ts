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
    const t = this.snapshot.totals;
    const isTiger = this.snapshot.key === 'tiger';
    if (isTiger) {
      return [
        { label: 'Invested', value: this.fmt.transform(t.invested, 'usd'), barPct: 77, barColor: 'var(--tiger)', graphLabel: '96.7% of contributed', sub: 'Total contributed $100,782.50' },
        { label: 'Unrealised', value: this.fmt.transform(t.unrealised, 'signed'), valueClass: 'pos', barPct: 48, barColor: 'var(--green)', graphLabel: '+12.80% of contributed', graphLabelClass: 'pos', sub: '+12.80% of total contributed', subClass: 'pos' },
        { label: 'Realised', value: this.fmt.transform(t.realised, 'signed'), valueClass: 'pos', barPct: 56, barColor: 'var(--green)', graphLabel: '+14.14% of contributed', graphLabelClass: 'pos', sub: '+14.14% of total contributed', subClass: 'pos' },
        { label: 'Total with profit', value: this.fmt.transform(t.totalWithProfit, 'usd'), barPct: 100, barColor: 'var(--gold)', graphLabel: '+26.94% on contributed', graphLabelClass: 'pos', sub: '+26.94% on total contributed, before expenses', subClass: 'pos' },
      ];
    }
    return [
      { label: 'Invested', value: this.fmt.transform(t.invested, 'usd'), barPct: 49, barColor: 'var(--ibkr)', graphLabel: '49.3% of total amount', sub: 'of $13,916.16 total amount' },
      { label: 'Unrealised', value: this.fmt.transform(t.unrealised, 'signed'), valueClass: 'neg', barPct: 12, barColor: 'var(--red)', graphLabel: '−1.71% of total amount', graphLabelClass: 'neg', sub: '−1.71% of total amount', subClass: 'neg' },
      { label: 'Realised', value: this.fmt.transform(t.realised, 'usd'), barPct: 6, barColor: 'var(--muted)', graphLabel: 'No sales yet', sub: 'No sales yet' },
      { label: 'Account value', value: this.fmt.transform(t.totalWithProfit, 'usd'), barPct: 98, barColor: 'var(--ibkr)', graphLabel: 'Equity + cash', sub: 'Equity $6,628 + cash $7,051' },
    ];
  }
}
