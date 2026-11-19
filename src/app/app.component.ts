import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ChallengeHeroComponent } from './features/challenge-hero/challenge-hero.component';
import { BrokerTabsComponent } from './features/broker-tabs/broker-tabs.component';
import { CombinedOverviewComponent } from './features/combined-overview/combined-overview.component';
import { BrokerSectionComponent } from './features/broker-section/broker-section.component';
import { PortfolioDataService } from './core/services/portfolio-data.service';
import { UiPreferencesService } from './core/services/ui-preferences.service';

/**
 * Top-level shell: hero + tabs + footer.
 * Data comes from PortfolioDataService (static Wednesday 18 Nov 2026 snapshot
 * until APPS_SCRIPT_DATA_URL is configured — then live, refreshed every 15 min).
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChallengeHeroComponent, BrokerTabsComponent, CombinedOverviewComponent, BrokerSectionComponent, DatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  protected dataSvc = inject(PortfolioDataService);
  protected prefs = inject(UiPreferencesService);

  ngOnInit(): void {
    // Fetch on load, then every 15 min (browser only; no timer during SSR/build).
    this.dataSvc.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.dataSvc.stopAutoRefresh();
  }
}
