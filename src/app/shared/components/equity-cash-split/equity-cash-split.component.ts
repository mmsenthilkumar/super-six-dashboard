import { Component, Input } from '@angular/core';
import { PortfolioFormatPipe } from '../../pipes/portfolio-format.pipe';

/** Equity/cash progress bar + cash/contributed caption — always visible, below the stock list. */
@Component({
  selector: 'app-equity-cash-split',
  standalone: true,
  imports: [PortfolioFormatPipe],
  templateUrl: './equity-cash-split.component.html',
  styleUrl: './equity-cash-split.component.scss',
})
export class EquityCashSplitComponent {
  @Input({ required: true }) equityPct!: number;
  @Input({ required: true }) cashPct!: number;
  @Input({ required: true }) cash!: number;
  @Input({ required: true }) contributed!: number;
  @Input() contributedLabel = 'Total contributed';
}
