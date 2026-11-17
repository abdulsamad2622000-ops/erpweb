import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { FormFieldComponent } from './form-field.component';

@Component({
  imports: [FormFieldComponent, ReactiveFormsModule],
  template: `
    <app-form-field label="Name" inputId="name" hint="Product name" [required]="true" [control]="ctrl">
      <input id="name" [formControl]="ctrl" />
    </app-form-field>
  `,
})
class HostComponent {
  ctrl = new FormControl('', Validators.required);
}

describe('FormFieldComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [
        HostComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows label and hint', () => {
    const el = setup().nativeElement as HTMLElement;
    expect(el.textContent).toContain('Name');
    expect(el.textContent).toContain('Product name');
  });

  it('shows no error before the field is touched', () => {
    const el = setup().nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows the error and hides the hint after touch', async () => {
    const fixture = setup();
    fixture.componentInstance.ctrl.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('common.errors.required');
    expect(el.textContent).not.toContain('Product name');
  });
});
