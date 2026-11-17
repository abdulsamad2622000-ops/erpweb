import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { NumberInputComponent } from './number-input.component';

@Component({
  imports: [NumberInputComponent, ReactiveFormsModule],
  template: `<app-number-input inputId="amt" prefix="Rs" [decimals]="2" [min]="0" [formControl]="ctrl" />`,
})
class HostComponent {
  ctrl = new FormControl<number | null>(null);
}

describe('NumberInputComponent', () => {
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

  it('type karne par control mein number jata hai', () => {
    const { type, ctrl } = setup();
    type('1,250.5');
    expect(ctrl.value).toBe(1250.5);
    expect(ctrl.valid).toBe(true);
  });

  it('blur par format hota hai', () => {
    const { fixture, input, type } = setup();
    type('1250.5');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(input.value).toBe('1,250.50');
  });

  it('control se value likhne par format dikhta hai', () => {
    const { fixture, input, ctrl } = setup();
    ctrl.setValue(1234.5);
    fixture.detectChanges();
    expect(input.value).toBe('1,234.50');
  });

  it('ghalat text par pattern error', () => {
    const { type, ctrl } = setup();
    type('abc');
    expect(ctrl.value).toBeNull();
    expect(ctrl.errors?.['pattern']).toBe(true);
  });

  it('min se neeche par min error', () => {
    const { type, ctrl } = setup();
    type('-5');
    expect(ctrl.errors?.['min']).toBeTruthy();
  });

  it('khali karne par null aur valid', () => {
    const { type, ctrl } = setup();
    type('10');
    type('');
    expect(ctrl.value).toBeNull();
    expect(ctrl.valid).toBe(true);
  });
});