import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ChallengeHeroComponent } from './features/challenge-hero/challenge-hero.component';
import { BrokerTabsComponent } from './features/broker-tabs/broker-tabs.component';
import { CombinedOverviewComponent } from './features/combined-overview/combined-overview.component';
import { BrokerSectionComponent } from './features/broker-section/broker-section.component';
import { APP_VERSION, PortfolioDataService } from './core/services/portfolio-data.service';
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
  protected appVersion = APP_VERSION;

  /** Pull-to-refresh state: distance pulled (px) + phase. Same smart refresh
   *  as the refresh button — re-fetches sheet data, reloads only if a new
   *  build is live. A plain browser reload would drop tab/scroll/font and
   *  can land on the Access sign-in if the 24h session expired, so the
   *  custom gesture (with overscroll-behavior disabled in styles.scss)
   *  replaces the browser's native pull-to-refresh.
   *
   *  FIX 20 Nov 2026: the first version grabbed EVERY downward touch at
   *  the top of the page and called preventDefault() on the first move
   *  event, which swallowed normal scrolling. Now it only takes over
   *  once the pull is clearly intentional (past PTR_ARM_PX), and it
   *  checks the real scroller (scrollingElement, not just window.scrollY)
   *  so a page that can still scroll up never triggers the gesture. */
  protected ptrY = signal(0);
  protected ptrState = signal<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');
  private ptrStartY = 0;
  private ptrTracking = false;
  private ptrEngaged = false;
  private ptrRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly PTR_THRESHOLD = 64;
  private static readonly PTR_ARM_PX = 12;

  private atTop(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const el = document.scrollingElement ?? document.documentElement;
    return window.scrollY <= 0 && (el?.scrollTop ?? 0) <= 0;
  }

  private onTouchStart = (e: TouchEvent): void => {
    if (this.ptrState() === 'refreshing' || e.touches.length !== 1) return;
    if (!this.atTop()) return;
    this.ptrTracking = true;
    this.ptrEngaged = false;
    this.ptrStartY = e.touches[0].clientY;
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.ptrTracking || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - this.ptrStartY;
    if (dy <= 0 || !this.atTop()) {
      // Scrolling the page (or no longer at the top): hand back to native scroll.
      this.ptrTracking = false;
      this.ptrEngaged = false;
      this.ptrY.set(0);
      this.ptrState.set('idle');
      return;
    }
    // Don't steal the gesture for tiny jitters — let native scroll decide.
    if (!this.ptrEngaged && dy < AppComponent.PTR_ARM_PX) return;
    this.ptrEngaged = true;
    e.preventDefault();
    const y = Math.min((dy - AppComponent.PTR_ARM_PX) * 0.5, 96);
    this.ptrY.set(y);
    this.ptrState.set(y >= AppComponent.PTR_THRESHOLD ? 'ready' : 'pulling');
  };

  private onTouchEnd = (): void => {
    if (!this.ptrTracking) return;
    this.ptrTracking = false;
    this.ptrEngaged = false;
    if (this.ptrState() === 'ready') {
      this.ptrState.set('refreshing');
      this.ptrY.set(56);
      this.dataSvc.refresh();
      this.ptrRefreshTimer = setTimeout(() => {
        this.ptrY.set(0);
        this.ptrState.set('idle');
      }, 2500);
    } else {
      this.ptrY.set(0);
      this.ptrState.set('idle');
    }
  };

  ngOnInit(): void {
    // Fetch on load, then every 15 min (browser only; no timer during SSR/build).
    this.dataSvc.startAutoRefresh();
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
  }

  ngOnDestroy(): void {
    this.dataSvc.stopAutoRefresh();
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);
    if (this.ptrRefreshTimer) clearTimeout(this.ptrRefreshTimer);
  }
}
