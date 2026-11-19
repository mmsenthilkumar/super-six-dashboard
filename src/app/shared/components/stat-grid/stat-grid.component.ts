import { Component, Input } from '@angular/core';

export interface StatItem {
  label: string;
  /** Already-formatted value, e.g. "$141,612" or "+$12,663". */
  value: string;
  valueClass?: 'pos' | 'neg' | '';
  sub: string;
  subClass?: 'pos' | 'neg' | '';
  /** Mini bar width 0–100 and colour (CSS var or hex). */
  barPct: number;
  barColor: string;
  /** Spark bar heights 0–100 (4 bars, rising). */
  spark?: number[];
  graphLabel?: string;
  graphLabelClass?: 'pos' | 'neg' | '';
}

/** 4-card KPI grid (supports the compact hero mode and the larger broker/combined mode). */
@Component({
  selector: 'app-stat-grid',
  standalone: true,
  templateUrl: './stat-grid.component.html',
  styleUrl: './stat-grid.component.scss',
})
export class StatGridComponent {
  @Input({ required: true }) stats: StatItem[] = [];
  @Input() ariaLabel = 'Totals';
  @Input() large = false;
}
