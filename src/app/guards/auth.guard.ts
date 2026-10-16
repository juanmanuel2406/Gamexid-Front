import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, CanActivate, Router } from '@angular/router';
import { GamexidService } from '../services-gamexid/gamexid-service';
import { Workspace } from '../core/workspace';
import { map, catchError, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private service = inject(GamexidService);
  private workspace = inject(Workspace);
  canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.canActivate(route, state);
  }
  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.service.session().pipe(
      map((user) => {
        this.workspace.setUser(user);
        return true;
      }),
      catchError(() => of(this.router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }))),
    );
  }
}
