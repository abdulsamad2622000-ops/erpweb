import { Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { isIos, isStandalone } from './pwa-utils';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'erp.install.dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Install prompt (Android/Chrome) aur iOS hint, aur "naya version tayyar hai" ka prompt.
 * App start par bana diya jata hai taake beforeinstallprompt miss na ho.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly sw = inject(SwUpdate, { optional: true });
  private readonly deferred = signal<InstallEvent | null>(null);
  private readonly dismissed = signal(readDismissed());
  private readonly standalone = signal(
    isStandalone(navigator as { standalone?: boolean }, typeof window.matchMedia === 'function' ? (q) => window.matchMedia(q) : undefined),
  );
  private readonly ios = isIos(navigator.userAgent, navigator.maxTouchPoints);

  /** Naya version download ho chuka, reload par lagega. */
  readonly updateReady = signal(false);
  readonly canInstall = computed(() => this.deferred() !== null && !this.dismissed() && !this.standalone());
  readonly showIosHint = computed(() => this.ios && !this.standalone() && !this.dismissed());

  constructor() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred.set(e as InstallEvent);
    });
    window.addEventListener('appinstalled', () => {
      this.deferred.set(null);
      this.standalone.set(true);
    });
    if (this.sw?.isEnabled) {
      this.sw.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => this.updateReady.set(true));
    }
  }

  async install(): Promise<void> {
    const e = this.deferred();
    if (!e) return;
    await e.prompt();
    this.deferred.set(null);
  }

  dismissInstall(): void {
    this.dismissed.set(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage band ho to sirf is session mein chhupa rahega.
    }
  }

  async applyUpdate(): Promise<void> {
    try {
      await this.sw?.activateUpdate();
    } finally {
      window.location.reload();
    }
  }
}