import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanCameraComponent, ZXING_LOADER, ZxingModule } from './scan-camera.component';

class FakeDetector {
  detect(): Promise<{ rawValue: string }[]> {
    return Promise.resolve([{ rawValue: ' ABC123 ' }]);
  }
}

// jsdom mein <dialog> aur video.play nahi hote, is liye stub.
beforeAll(() => {
  const dlg = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  dlg['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dlg['close'] = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  (HTMLMediaElement.prototype as unknown as Record<string, unknown>)['play'] = () =>
    Promise.resolve();
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ScanCameraComponent', () => {
  let stopped = 0;

  function setMedia(getUserMedia: (() => Promise<MediaStream>) | undefined) {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: getUserMedia ? { getUserMedia } : undefined,
      configurable: true,
    });
  }

  const goodStream = () =>
    Promise.resolve({ getTracks: () => [{ stop: () => stopped++ }] } as unknown as MediaStream);

  beforeEach(() => {
    stopped = 0;
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setMedia(undefined);
  });

  function setup(providers: Provider[] = []) {
    TestBed.configureTestingModule({
      providers,
      imports: [
        ScanCameraComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(ScanCameraComponent);
    fixture.componentRef.setInput('intervalMs', 5);
    fixture.detectChanges();
    const codes: string[] = [];
    let closed = 0;
    fixture.componentInstance.detected.subscribe((c) => codes.push(c));
    fixture.componentInstance.closed.subscribe(() => closed++);
    const open = async () => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      await wait(40);
      fixture.detectChanges();
    };
    return { fixture, el: fixture.nativeElement as HTMLElement, codes, open, closed: () => closed };
  }

  it('camera API hi na ho to message dikhata hai', async () => {
    setMedia(undefined);
    const { el, open } = setup();
    await open();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('common.scan.cameraUnsupported');
  });

  it('camera ki ijazat na mile to message dikhata hai', async () => {
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    setMedia(() => Promise.reject(new Error('denied')));
    const { el, open } = setup();
    await open();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('common.scan.cameraDenied');
  });

  it('code milne par detected aur closed aate hain aur camera band hota hai', async () => {
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    setMedia(goodStream);
    const { codes, open, closed } = setup();
    await open();
    expect(codes).toEqual(['ABC123']);
    expect(closed()).toBe(1);
    expect(stopped).toBe(1);
  });

  it('cancel dabane par camera band hota hai aur closed aata hai', async () => {
    vi.stubGlobal('BarcodeDetector', class {
      detect(): Promise<{ rawValue: string }[]> {
        return Promise.resolve([]);
      }
    });
    setMedia(goodStream);
    const { el, open, closed, codes } = setup();
    await open();
    (el.querySelector('button') as HTMLButtonElement).click();
    expect(closed()).toBe(1);
    expect(stopped).toBe(1);
    expect(codes).toEqual([]);
  });

  it('BarcodeDetector na ho to ZXing se code milta hai aur camera band hota hai', async () => {
    let zxingStops = 0;
    const controls = { stop: () => zxingStops++ };
    class FakeReader {
      decodeFromConstraints(
        _constraints: unknown,
        _video: unknown,
        cb: (r: { getText(): string } | undefined, e: undefined, c: typeof controls) => void,
      ): Promise<typeof controls> {
        cb({ getText: () => ' ZX1 ' }, undefined, controls);
        return Promise.resolve(controls);
      }
    }
    const fake = { BrowserMultiFormatReader: FakeReader } as unknown as ZxingModule;
    setMedia(goodStream);
    const { codes, open, closed } = setup([{ provide: ZXING_LOADER, useValue: () => Promise.resolve(fake) }]);
    await open();
    expect(codes).toEqual(['ZX1']);
    expect(closed()).toBe(1);
    expect(zxingStops).toBe(1);
  });

  it('ZXing fail ho to camera denied ka message dikhata hai', async () => {
    setMedia(goodStream);
    const { el, open } = setup([
      { provide: ZXING_LOADER, useValue: () => Promise.reject(new Error('chunk load failed')) },
    ]);
    await open();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('common.scan.cameraDenied');
  });
});