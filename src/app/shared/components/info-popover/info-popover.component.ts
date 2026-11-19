import { Component, HostListener, Input, inject } from '@angular/core';
import { UiPreferencesService } from '../../../core/services/ui-preferences.service';

/** Accessible "(i)" button + popover; closes on Esc or a click outside. One popover open at a time (via UiPreferencesService). */
@Component({
  selector: 'app-info-popover',
  standalone: true,
  templateUrl: './info-popover.component.html',
  styleUrl: './info-popover.component.scss',
})
export class InfoPopoverComponent {
  @Input({ required: true }) popoverId!: string;
  @Input({ required: true }) text!: string;
  @Input() label = 'More information';
  @Input() flip: 'none' | 'flip' | 'flip-l' = 'flip-l';
  protected prefs = inject(UiPreferencesService);

  protected get open(): boolean { return this.prefs.isPopoverOpen(this.popoverId); }
  protected toggle(event: Event): void { event.stopPropagation(); this.prefs.togglePopover(this.popoverId); }

  @HostListener('document:click')
  onDocumentClick(): void { this.prefs.closePopover(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.prefs.closePopover(); }
}
