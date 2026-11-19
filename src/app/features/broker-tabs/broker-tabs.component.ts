import { Component, inject } from '@angular/core';
import { UiPreferencesService } from '../../core/services/ui-preferences.service';
import type { ViewTab } from '../../core/models/portfolio.models';

/** Accessible tablist: "Both brokers" / "Tiger only" / "IBKR only". */
@Component({
  selector: 'app-broker-tabs',
  standalone: true,
  templateUrl: './broker-tabs.component.html',
  styleUrl: './broker-tabs.component.scss',
})
export class BrokerTabsComponent {
  protected prefs = inject(UiPreferencesService);
  protected readonly tabs: { id: ViewTab; label: string }[] = [
    { id: 'both', label: 'Both brokers' },
    { id: 'tiger', label: 'Tiger only' },
    { id: 'ibkr', label: 'IBKR only' },
  ];
}
