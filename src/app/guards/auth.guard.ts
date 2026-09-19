import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { FastScanService } from '../services-fastscan/fastscan-service';
import { map, catchError, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router, private service: FastScanService) {}

  canActivate() {
    return this.service.session().pipe(
      map(user => {
        sessionStorage.setItem('usuario', user.fullName);
        sessionStorage.setItem('userData', JSON.stringify(user));
        return true;
      }),
      catchError(() => of(this.router.parseUrl('/login')))
    );
  }
}
