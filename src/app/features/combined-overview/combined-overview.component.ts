import { Component, Input, inject } from '@angular/core';
import { StatGridComponent, type StatItem } from '../../shared/components/stat-grid/stat-grid.component';
import { PortfolioDataService } from '../../core/services/portfolio-data.service';
import { PortfolioFormatPipe } from '../../shared/pipes/portfolio-format.pipe';
import type { PortfolioData } from '../../core/models/portfolio.models';

/** "Both brokers" panel: combined totals only (no holdings list). */
@Component({
  selector: 'app-combined-overview',
  standalone: true,
  imports: [StatGridComponent],
  templateUrl: './combined-overview.component.html',
  styleUrl: './combined-overview.component.scss',
})
export class CombinedOverviewComponent {
  @Input({ required: true }) data!: PortfolioData;
  private fmt = new PortfolioFormatPipe();

  protected get stats(): StatItem[] {
    const c = this.data.challenge;
    const t = this.data.tiger.totals;
    const i = this.data.ibkr.totals;
    const unrealPct = +((c.unrealised / c.invested) * 100).toFixed(1);
    const realisedPct = +((c.realised / c.invested) * 100).toFixed(1);
    return [
      { label: 'Combined value', value: this.fmt.transform(c.combined, 'usd'), barPct: c.combinedPct, barColor: 'var(--gold)', graphLabel: `${c.combinedPct}% of $1M`, sub: `Tiger ${this.fmt.transform(t.totalWithProfit, 'usd')} · IBKR ${this.fmt.transform(i.totalWithProfit, 'usd')}` },
      { label: 'Total invested', value: this.fmt.transform(c.invested, 'usd'), barPct: 74, barColor: 'var(--tiger)', graphLabel: '74% of value', sub: `Tiger ${this.fmt.transform(t.invested, 'usd')} · IBKR ${this.fmt.transform(i.invested, 'usd')}` },
      { label: 'Unrealised P/L', value: this.fmt.transform(c.unrealised, 'signed'), valueClass: c.unrealised >= 0 ? 'pos' : 'neg', barPct: 46, barColor: 'var(--green)', graphLabel: `${unrealPct >= 0 ? '+' : ''}${unrealPct}% on invested`, graphLabelClass: 'pos', sub: `Tiger ${this.fmt.transform(t.unrealised, 'signed')} · IBKR ${this.fmt.transform(i.unrealised, 'signed')}` },
      { label: 'Realised P/L', value: this.fmt.transform(c.realised, 'signed'), valueClass: 'pos', barPct: 54, barColor: 'var(--green)', graphLabel: `+${realisedPct}% on invested`, graphLabelClass: 'pos', sub: 'All from Tiger so far' },
    ];
  }
}
