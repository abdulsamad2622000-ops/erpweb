import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthStore } from './auth.store';

/**
 * <button *hasPermission="'pos.sale.create'">...</button>
 * <div *hasPermission="['a.b.view','c.d.view']">  (koi bhi ek kafi hai)
 * Sirf UI hide/show. Backend enforcement alag hai.
 */
@Directive({ selector: '[hasPermission]' })
export class HasPermissionDirective {
  readonly hasPermission = input.required<string | string[]>();

  private readonly store = inject(AuthStore);
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private shown = false;

  constructor() {
    effect(() => {
      const raw = this.hasPermission();
      const keys = Array.isArray(raw) ? raw : [raw];
      const allowed = keys.some((k) => this.store.can(k));
      if (allowed && !this.shown) {
        this.vcr.createEmbeddedView(this.tpl);
        this.shown = true;
      } else if (!allowed && this.shown) {
        this.vcr.clear();
        this.shown = false;
      }
    });
  }
}