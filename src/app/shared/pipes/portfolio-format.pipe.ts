import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats money / percentages the way the prototype does:
 *   'usd'       → $141,612            (no decimals, rounded)
 *   'usd2'      → $12,489.04          (2 decimals)
 *   'signed'    → +$12,663 / −$238   (signed, no decimals)
 *   'signed2'   → +$12,901.20 / −$237.77
 *   'pct'       → 14.2% / 95.11%
 *   'price'     → 352.45 / NA        (passes the sheet's "NA" string through)
 */
@Pipe({ name: 'portfolioFormat', standalone: true })
export class PortfolioFormatPipe implements PipeTransform {
  transform(value: number | string | null | undefined, kind: 'usd' | 'usd2' | 'signed' | 'signed2' | 'pct' | 'price' = 'usd', decimals = 0): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string') return value; // e.g. DRAM price "NA"
    const n = value;
    switch (kind) {
      case 'usd': return '$' + Math.round(n).toLocaleString('en-US');
      case 'usd2': return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'signed': return (n >= 0 ? '+' : '−') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
      case 'signed2': return (n >= 0 ? '+' : '−') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'pct': return n.toFixed(decimals) + '%';
      case 'price': return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
}
