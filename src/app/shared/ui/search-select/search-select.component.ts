import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, Subject, catchError, debounce, of, switchMap, take, timer } from 'rxjs';

export type SelectOptionId = string | number;
export interface SelectOption {
  id: SelectOptionId;
  label: string;
}

/**
 * Type karke server se dhoondne wala select. Control ki value sirf id hoti hai.
 * [loader]  : (query) => Observable<SelectOption[]>   (zaroori)
 * [resolve] : (id) => Observable<SelectOption | null> (edit page par id ka label laane ke liye)
 * Keys: ArrowUp/ArrowDown, Enter, Escape (Escape dialog ko band nahi karta jab list khuli ho).
 */
@Component({
  selector: 'app-search-select',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchSelectComponent), multi: true },
  ],
  template: `
    <div class="relative">
      <input
        [id]="inputId()"
        type="text"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="open() ? listId() : null"
        [attr.aria-activedescendant]="activeId()"
        [attr.aria-describedby]="describedBy() || null"
        [attr.placeholder]="placeholder() || null"
        class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent ps-3 pe-10 text-sm"
        [value]="display()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (focus)="onFocus($event)"
        (blur)="onBlur()"
        (keydown)="onKey($event)" />

      @if (valueId() !== null && !disabled()) {
        <button
          type="button"
          class="absolute inset-y-0 end-0 inline-flex w-10 items-center justify-center rounded-e-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          [attr.aria-label]="'common.clear' | transloco"
          (mousedown)="$event.preventDefault()"
          (click)="clear()">
          <i class="pi pi-times text-xs" aria-hidden="true"></i>
        </button>
      }

      @if (open()) {
        <ul
          [id]="listId()"
          role="listbox"
          class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          @if (loading()) {
            <li role="status" class="px-3 py-3 text-sm text-slate-600 dark:text-slate-400">
              {{ 'common.loading' | transloco }}
            </li>
          } @else if (options().length === 0) {
            <li role="status" class="px-3 py-3 text-sm text-slate-600 dark:text-slate-400">
              {{ 'common.empty' | transloco }}
            </li>
          } @else {
            @for (o of options(); track o.id; let i = $index) {
              <li
                role="option"
                [id]="optionId(i)"
                [attr.aria-selected]="o.id === valueId()"
                class="flex min-h-11 cursor-pointer items-center px-3 text-sm"
                [class]="i === active() ? 'bg-blue-100 dark:bg-slate-700' : ''"
                (mousedown)="pick(o, $event)">
                {{ o.label }}
              </li>
            }
          }
        </ul>
      }
    </div>
  `,
})
export class SearchSelectComponent implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly loader = input.required<(query: string) => Observable<SelectOption[]>>();
  readonly resolve = input<((id: SelectOptionId) => Observable<SelectOption | null>) | null>(null);
  readonly placeholder = input('');
  readonly describedBy = input('');
  readonly debounceMs = input(250);

  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly options = signal<SelectOption[]>([]);
  protected readonly active = signal(-1);
  protected readonly valueId = signal<SelectOptionId | null>(null);
  private readonly selected = signal<SelectOption | null>(null);
  private readonly editing = signal<string | null>(null);
  private readonly query$ = new Subject<string>();

  protected readonly display = computed(() => this.editing() ?? this.selected()?.label ?? '');
  protected readonly listId = computed(() => `${this.inputId()}-list`);
  protected readonly activeId = computed(() =>
    this.open() && !this.loading() && this.active() >= 0 ? this.optionId(this.active()) : null,
  );

  private onChange: (v: SelectOptionId | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.query$
      .pipe(
        debounce(() => timer(this.debounceMs())),
        switchMap((q) => this.loader()(q).pipe(catchError(() => of([] as SelectOption[])))),
        takeUntilDestroyed(),
      )
      .subscribe((opts) => {
        this.options.set(opts);
        this.active.set(opts.length > 0 ? 0 : -1);
        this.loading.set(false);
      });

    // Edit page: control mein id aaye aur label na ho to resolve se label lao.
    effect(() => {
      const r = this.resolve();
      const id = this.valueId();
      if (!r || id === null || this.selected() !== null) return;
      untracked(() => {
        r(id)
          .pipe(
            take(1),
            catchError(() => of(null)),
          )
          .subscribe((o) => {
            if (o && this.valueId() === o.id) this.selected.set(o);
          });
      });
    });
  }

  writeValue(v: SelectOptionId | null): void {
    this.valueId.set(v ?? null);
    if (this.selected()?.id !== v) this.selected.set(null);
    this.editing.set(null);
  }
  registerOnChange(fn: (v: SelectOptionId | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }

  protected optionId(i: number): string {
    return `${this.inputId()}-opt-${i}`;
  }

  protected onFocus(e: Event): void {
    (e.target as HTMLInputElement).select();
    this.openList(this.editing() ?? '');
  }

  protected onInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    this.editing.set(raw);
    if (this.valueId() !== null) {
      this.valueId.set(null);
      this.selected.set(null);
      this.onChange(null);
    }
    this.openList(raw);
  }

  protected onBlur(): void {
    this.onTouched();
    this.open.set(false);
    this.editing.set(null);
  }

  protected onKey(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (this.open()) this.move(1);
        else this.openList(this.editing() ?? '');
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.open()) this.move(-1);
        break;
      case 'Enter': {
        if (this.open() && !this.loading()) {
          const o = this.options()[this.active()];
          if (o) {
            e.preventDefault();
            this.pick(o);
          }
        }
        break;
      }
      case 'Escape':
        if (this.open()) {
          e.preventDefault();
          e.stopPropagation();
          this.open.set(false);
        }
        break;
    }
  }

  protected pick(o: SelectOption, e?: Event): void {
    e?.preventDefault();
    this.valueId.set(o.id);
    this.selected.set(o);
    this.editing.set(null);
    this.open.set(false);
    this.onChange(o.id);
  }

  protected clear(): void {
    this.valueId.set(null);
    this.selected.set(null);
    this.editing.set(null);
    this.onChange(null);
  }

  private openList(q: string): void {
    this.open.set(true);
    this.loading.set(true);
    this.query$.next(q);
  }

  private move(delta: number): void {
    const n = this.options().length;
    if (n === 0) return;
    this.active.set(Math.min(n - 1, Math.max(0, this.active() + delta)));
    queueMicrotask(() =>
      document.getElementById(this.optionId(this.active()))?.scrollIntoView({ block: 'nearest' }),
    );
  }
}