import { Injectable, computed, signal } from '@angular/core';
import type { ViewTab } from '../models/portfolio.models';

/** Font-size steps matching the prototype's +/- box: 85% – 132%. */
export const FONT_STEPS = [85, 92, 100, 108, 117, 124, 132];

@Injectable({ providedIn: 'root' })
export class UiPreferencesService {
  readonly activeTab = signal<ViewTab>('both');
  private fontStepIndex = signal(2); // 100%
  readonly fontScale = computed(() => FONT_STEPS[this.fontStepIndex()]);
  readonly fontScalePct = computed(() => `${this.fontScale()}%`);
  readonly canDecreaseFont = computed(() => this.fontStepIndex() > 0);
  readonly canIncreaseFont = computed(() => this.fontStepIndex() < FONT_STEPS.length - 1);
  /** Id of the currently open info popover, or null. */
  readonly openPopover = signal<string | null>(null);

  setTab(tab: ViewTab): void { this.activeTab.set(tab); }
  decreaseFont(): void { if (this.canDecreaseFont()) this.fontStepIndex.update((i) => i - 1); }
  increaseFont(): void { if (this.canIncreaseFont()) this.fontStepIndex.update((i) => i + 1); }
  togglePopover(id: string): void { this.openPopover.update((cur) => (cur === id ? null : id)); }
  closePopover(): void { this.openPopover.set(null); }
  isPopoverOpen(id: string): boolean { return this.openPopover() === id; }
}
