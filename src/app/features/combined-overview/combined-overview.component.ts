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
    // Every number here is computed live — no hardcoded percentages.
    // Bars show each figure as % of its base (value for invested, invested
    // for the P/L rows), capped at 100.
    const c = this.data.challenge;
    const t = this.data.tiger.totals;
    const i = this.data.ibkr.totals;
    const unrealPct = c.invested ? +((c.unrealised / c.invested) * 100).toFixed(1) : 0;
    const realisedPct = c.invested ? +((c.realised / c.invested) * 100).toFixed(1) : 0;
    const investedPct = c.combined ? +((c.invested / c.combined) * 100).toFixed(1) : 0;
    return [
      { label: 'Combined value', value: this.fmt.transform(c.combined, 'usd'), barPct: c.combinedPct, barColor: 'var(--gold)', graphLabel: `${c.combinedPct}% of $1M`, sub: `Tiger ${this.fmt.transform(t.totalWithProfit, 'usd')} · IBKR ${this.fmt.transform(i.totalWithProfit, 'usd')}` },
      { label: 'Total invested', value: this.fmt.transform(c.invested, 'usd'), barPct: investedPct, barColor: 'var(--tiger)', graphLabel: `${investedPct}% of value`, sub: `Tiger ${this.fmt.transform(t.invested, 'usd')} · IBKR ${this.fmt.transform(i.invested, 'usd')}` },
      { label: 'Unrealised P/L', value: this.fmt.transform(c.unrealised, 'signed'), valueClass: c.unrealised >= 0 ? 'pos' : 'neg', barPct: Math.min(100, Math.abs(unrealPct)), barColor: 'var(--green)', graphLabel: `${unrealPct >= 0 ? '+' : ''}${unrealPct}% on invested`, graphLabelClass: 'pos', sub: `Tiger ${this.fmt.transform(t.unrealised, 'signed')} · IBKR ${this.fmt.transform(i.unrealised, 'signed')}` },
      { label: 'Realised P/L', value: this.fmt.transform(c.realised, 'signed'), valueClass: 'pos', barPct: Math.min(100, Math.abs(realisedPct)), barColor: 'var(--green)', graphLabel: `+${realisedPct}% on invested`, graphLabelClass: 'pos', sub: i.realised === 0 ? 'All from Tiger so far' : `Tiger ${this.fmt.transform(t.realised, 'signed')} · IBKR ${this.fmt.transform(i.realised, 'signed')}` },
    ];
  }
}
