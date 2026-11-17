import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { HasPermissionDirective } from './has-permission.directive';

@Component({
  selector: 'app-test-host',
  imports: [HasPermissionDirective],
  template: `
    <p *hasPermission="'a.b.view'" id="yes">yes</p>
    <p *hasPermission="'x.y.view'" id="no">no</p>
    <p *hasPermission="['x.y.view', 'a.b.view']" id="any">any</p>
  `,
})
class TestHostComponent {}

describe('HasPermissionDirective', () => {
  it('sirf allowed elements dikhata hai', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            me: () =>
              of({
                user: { id: 1, name: 'T', role: 'staff', isSuperAdmin: false },
                permissions: [{ key: 'a.b.view', scope: 'all', expiresAt: null, limit: null }],
              }),
          },
        },
      ],
    });
    await TestBed.inject(AuthStore).load();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#yes')).not.toBeNull();
    expect(el.querySelector('#no')).toBeNull();
    expect(el.querySelector('#any')).not.toBeNull();
  });
});