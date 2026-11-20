import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { InfoPopoverComponent } from '../../shared/components/info-popover/info-popover.component';
import { PortfolioFormatPipe } from '../../shared/pipes/portfolio-format.pipe';
import { UiPreferencesService } from '../../core/services/ui-preferences.service';
import { APP_ICON_DATA_URI } from '../../shared/app-icon';
import type { ChallengeMeta } from '../../core/models/portfolio.models';

/** Header: group name, title, month chip, +/- text-size box + refresh, progress bar, milestone strip. */
@Component({
  selector: 'app-challenge-hero',
  standalone: true,
  imports: [InfoPopoverComponent, PortfolioFormatPipe],
  templateUrl: './challenge-hero.component.html',
  styleUrl: './challenge-hero.component.scss',
})
export class ChallengeHeroComponent {
  @Input({ required: true }) challenge!: ChallengeMeta;
  @Output() refresh = new EventEmitter<void>();
  protected prefs = inject(UiPreferencesService);
  protected appIcon = APP_ICON_DATA_URI;

  /** Milestone posts on the straight-line graph (value in USD → position
   *  along the line, %). Hand-placed: $0 at 2.5%, then 100k/250k/500k/1M. */
  private static readonly MILESTONES = [
    { value: 0, pct: 2.5 },
    { value: 100_000, pct: 22.5 },
    { value: 250_000, pct: 47.5 },
    { value: 500_000, pct: 72.5 },
    { value: 1_000_000, pct: 97.5 },
  ];

  /** "Now" label from the LIVE combined total, e.g. $142k. */
  protected get nowLabel(): string {
    return '$' + Math.round(this.challenge.combined / 1000) + 'k';
  }

  /** Position of the "now" marker along the line (%), log-interpolated
   *  between the surrounding milestone posts — matches the hand-placed
   *  32.5% the $142k total had. Moves as the market moves the total. */
  protected get nowPct(): number {
    const v = this.challenge.combined;
    const ms = ChallengeHeroComponent.MILESTONES;
    if (v <= 0) return ms[0].pct;
    for (let i = 1; i < ms.length; i++) {
      if (v <= ms[i].value) {
        const lo = ms[i - 1];
        const hi = ms[i];
        const f = lo.value <= 0 ? v / hi.value : Math.log(v / lo.value) / Math.log(hi.value / lo.value);
        return lo.pct + f * (hi.pct - lo.pct);
      }
    }
    return ms[ms.length - 1].pct;
  }

  /** X in the 320-wide SVG for a position %. */
  protected x(pct: number): number {
    return Math.round((pct / 100) * 320);
  }

  /** Solid part of the line: start, each passed milestone, then now. */
  protected get solidPoints(): string {
    const pts = ChallengeHeroComponent.MILESTONES.filter((m) => m.value <= this.challenge.combined).map(
      (m) => `${this.x(m.pct)},15`,
    );
    pts.push(`${this.x(this.nowPct)},15`);
    return pts.join(' ');
  }

  /** Dashed part: now, then each milestone not yet reached. */
  protected get dashedPoints(): string {
    const pts = [`${this.x(this.nowPct)},15`];
    for (const m of ChallengeHeroComponent.MILESTONES) {
      if (m.value > this.challenge.combined) pts.push(`${this.x(m.pct)},15`);
    }
    return pts.join(' ');
  }

  /** True when a milestone value has been reached (marker shows done). */
  protected passed(value: number): boolean {
    return this.challenge.combined >= value;
  }
}
