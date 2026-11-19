import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { InfoPopoverComponent } from '../../shared/components/info-popover/info-popover.component';
import { PortfolioFormatPipe } from '../../shared/pipes/portfolio-format.pipe';
import { UiPreferencesService } from '../../core/services/ui-preferences.service';
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
  @Input() dataSource = 'static';
  @Output() refresh = new EventEmitter<void>();
  protected prefs = inject(UiPreferencesService);
}
