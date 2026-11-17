import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { DateInputComponent } from './date-input.component';

@Component({
  imports: [DateInputComponent, ReactiveFormsModule],
  template: `<app-date-input inputId="d" min="2026-11-20" [formControl]="ctrl" />`,
})
class HostComponent {
  ctrl = new FormControl<string | null>(null);
}

describe('DateInputComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const type = (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, input, type, ctrl: fixture.componentInstance.ctrl };
  }

  it('date control mein ISO string jati hai', () => {
    const { type, ctrl } = setup();
    type('2026-11-25');
    expect(ctrl.value).toBe('2026-11-25');
    expect(ctrl.valid).toBe(true);
  });

  it('min se pehle ki date par min error', () => {
    const { type, ctrl } = setup();
    type('2026-11-17');
    expect(ctrl.errors?.['min']).toBeTruthy();
  });

  it('khali karne par null', () => {
    const { type, ctrl } = setup();
    type('2026-11-25');
    type('');
    expect(ctrl.value).toBeNull();
  });

  it('control se value likhne par input mein dikhti hai', () => {
    const { fixture, input, ctrl } = setup();
    ctrl.setValue('2026-12-01');
    fixture.detectChanges();
    expect(input.value).toBe('2026-12-01');
  });
});