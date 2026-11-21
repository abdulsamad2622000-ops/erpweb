import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaService } from './pwa.service';

function installEvent() {
  return Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  });
}

describe('PwaService', () => {
  beforeEach(() => localStorage.clear());

  it('offers install after beforeinstallprompt and clears the offer after install', async () => {
    const svc = TestBed.inject(PwaService);
    expect(svc.canInstall()).toBe(false);
    const e = installEvent();
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(svc.canInstall()).toBe(true);
    await svc.install();
    expect(e.prompt).toHaveBeenCalled();
    expect(svc.canInstall()).toBe(false);
  });

  it('remembers when the user says Not now', () => {
    const svc = TestBed.inject(PwaService);
    window.dispatchEvent(installEvent());
    expect(svc.canInstall()).toBe(true);
    svc.dismissInstall();
    expect(svc.canInstall()).toBe(false);
    expect(localStorage.getItem('erp.install.dismissed')).toBe('1');
  });

  it('has no update waiting when the service worker is off', () => {
    expect(TestBed.inject(PwaService).updateReady()).toBe(false);
  });
});