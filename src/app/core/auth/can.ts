import { inject } from '@angular/core';
import { AuthStore } from './auth.store';

/** Injection context mein chalao: const can = injectCan(); can('pos.sale.create') */
export function injectCan(): (key: string) => boolean {
  const store = inject(AuthStore);
  return (key: string) => store.can(key);
}