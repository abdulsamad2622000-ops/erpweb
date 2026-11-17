import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PageToolbarComponent } from './page-toolbar.component';

@Component({
  imports: [PageToolbarComponent],
  template: `
    <app-page-toolbar
      title="Products"
      [breadcrumbs]="[{ label: 'Home', link: '/' }, { label: 'Products' }]"
    >
      <button type="button">New product</button>
    </app-page-toolbar>
  `,
})
class HostComponent {}

describe('PageToolbarComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the title in an h1', () => {
    expect(setup().querySelector('h1')?.textContent).toContain('Products');
  });

  it('marks the last breadcrumb as aria-current=page', () => {
    expect(setup().querySelector('[aria-current="page"]')?.textContent).toContain('Products');
  });

  it('projects the action button', () => {
    expect(setup().querySelector('button')?.textContent).toContain('New product');
  });
});
