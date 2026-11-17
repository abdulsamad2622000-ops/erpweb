import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  function create(label: string, tone?: 'success' | 'danger') {
    const fixture = TestBed.createComponent(StatusBadgeComponent);
    fixture.componentRef.setInput('label', label);
    if (tone) fixture.componentRef.setInput('tone', tone);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the label', () => {
    expect(create('Active', 'success').textContent).toContain('Active');
  });

  it('shows an icon along with the colour', () => {
    const el = create('Inactive', 'danger');
    expect(el.querySelector('i.pi-times-circle')).not.toBeNull();
  });

  it('defaults to the neutral tone', () => {
    const el = create('Draft');
    expect(el.querySelector('i.pi-minus-circle')).not.toBeNull();
  });
});
