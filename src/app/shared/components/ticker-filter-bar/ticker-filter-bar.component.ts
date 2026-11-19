import { Component, EventEmitter, Input, Output } from '@angular/core';

export type SortKey = 'ticker' | 'weight' | 'unreal' | 'unrealAsc' | 'invested';

/** Multi-chip ticker filter (type a ticker + Enter, repeat) + sort dropdown. */
@Component({
  selector: 'app-ticker-filter-bar',
  standalone: true,
  templateUrl: './ticker-filter-bar.component.html',
  styleUrl: './ticker-filter-bar.component.scss',
})
export class TickerFilterBarComponent {
  @Input() chips: string[] = [];
  @Input() sort: SortKey = 'ticker';
  @Input() brokerLabel = 'Tiger';
  @Output() chipsChange = new EventEmitter<string[]>();
  @Output() sortChange = new EventEmitter<SortKey>();

  protected onEnter(input: HTMLInputElement): void {
    const value = input.value.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
    if (value && !this.chips.includes(value)) this.chipsChange.emit([...this.chips, value]);
    input.value = '';
  }
  protected onComma(input: HTMLInputElement): void {
    // Comma-separated pastes: split into chips.
    const parts = input.value.split(',').map((p) => p.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '')).filter(Boolean);
    if (parts.length) this.chipsChange.emit([...new Set([...this.chips, ...parts])]);
    input.value = '';
  }
  protected removeChip(chip: string): void { this.chipsChange.emit(this.chips.filter((c) => c !== chip)); }
  protected onBackspace(input: HTMLInputElement): void {
    if (!input.value && this.chips.length) this.chipsChange.emit(this.chips.slice(0, -1));
  }
  protected onSort(value: string): void { this.sortChange.emit(value as SortKey); }
}
