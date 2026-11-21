import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ScanCameraComponent } from './scan-camera.component';

beforeAll(() => {
  const dlg = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  dlg['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dlg['close'] = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  (HTMLMediaElement.prototype as unknown as Record<string, unknown>)['play'] = () => Promise.resolve();
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ScanCameraComponent continuous mode', () => {
  let stopped = 0;

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  });

  async function run(values: string[]) {
    stopped = 0;
    let i = 0;
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        detect(): Promise<{ rawValue: string }[]> {
          return Promise.resolve([{ rawValue: values[Math.min(i++, values.length - 1)] }]);
        }
      },
    );
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () =>
          Promise.resolve({ getTracks: () => [{ stop: () => stopped++ }] } as unknown as MediaStream),
      },
      configurable: true,
    });
    TestBed.configureTestingModule({
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
    fixture.componentRef.setInput('continuous', true);
    fixture.detectChanges();
    const codes: string[] = [];
    let closed = 0;
    fixture.componentInstance.detected.subscribe((c) => codes.push(c));
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await wait(80);
    return { codes, closed: () => closed };
  }

  it('wahi code baar baar aaye to sirf ek baar milta hai aur camera khula rehta hai', async () => {
    const { codes, closed } = await run(['AAAA1111']);
    expect(codes).toEqual(['AAAA1111']);
    expect(closed()).toBe(0);
    expect(stopped).toBe(0);
  });

  it('naya code aaye to wo bhi milta hai', async () => {
    const { codes } = await run(['AAAA1111', 'AAAA1111', 'BBBB2222']);
    expect(codes).toEqual(['AAAA1111', 'BBBB2222']);
  });
});