import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { GamexidService } from '../services-gamexid/gamexid-service';
import { map, catchError, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  canActivateChild() {
    return this.canActivate();
  }
  constructor(
    private router: Router,
    private service: GamexidService,
  ) {}

  canActivate() {
    return this.service.session().pipe(
      map((user) => {
        sessionStorage.setItem('usuario', user.fullName);
        sessionStorage.setItem('userData', JSON.stringify(user));
        return true;
      }),
      catchError(() => of(this.router.parseUrl('/login'))),
    );
  }
}
