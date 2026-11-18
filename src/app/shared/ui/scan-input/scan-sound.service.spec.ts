import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanSoundService } from './scan-sound.service';

let oscillators = 0;

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  resume(): Promise<void> {
    return Promise.resolve();
  }
  createOscillator() {
    oscillators++;
    return {
      type: '',
      frequency: { value: 0 },
      connect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
    };
  }
  createGain() {
    return { gain: { value: 0 }, connect: () => undefined };
  }
}

describe('ScanSoundService', () => {
  beforeEach(() => {
    oscillators = 0;
    localStorage.clear();
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function create(): ScanSoundService {
    return TestBed.inject(ScanSoundService);
  }

  it('success par ek beep bajti hai', () => {
    create().success();
    expect(oscillators).toBe(1);
  });

  it('error par do beep bajti hain', () => {
    create().error();
    expect(oscillators).toBe(2);
  });

  it('mute par koi awaaz nahi', () => {
    const s = create();
    s.setMuted(true);
    s.success();
    s.error();
    expect(oscillators).toBe(0);
  });

  it('toggle mute badalta hai', () => {
    const s = create();
    expect(s.muted()).toBe(false);
    s.toggle();
    expect(s.muted()).toBe(true);
    s.toggle();
    expect(s.muted()).toBe(false);
  });

  it('mute ka choice storage mein yaad rehta hai', () => {
    create().setMuted(true);
    expect(localStorage.getItem('erp.scan.muted')).toBe('1');
  });

  it('audio na ho to error nahi aata', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('AudioContext', undefined);
    expect(() => create().success()).not.toThrow();
  });
});