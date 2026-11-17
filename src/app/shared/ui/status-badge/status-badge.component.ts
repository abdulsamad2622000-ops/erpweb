import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeTone = 'success' | 'neutral' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

// Sirf rang par bharosa nahi: har tone ka icon bhi hai.
const TONE_ICONS: Record<BadgeTone, string> = {
  success: 'pi pi-check-circle',
  neutral: 'pi pi-minus-circle',
  warning: 'pi pi-exclamation-triangle',
  danger: 'pi pi-times-circle',
  info: 'pi pi-info-circle',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      [class]="toneClass()"
    >
      <i [class]="icon()" aria-hidden="true"></i>
      <span>{{ label() }}</span>
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly label = input.required<string>();
  readonly tone = input<BadgeTone>('neutral');

  protected readonly toneClass = computed(() => TONE_CLASSES[this.tone()]);
  protected readonly icon = computed(() => TONE_ICONS[this.tone()]);
}
