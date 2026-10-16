import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { GamexidService } from '../services-gamexid/gamexid-service';
import { Workspace } from '../core/workspace';
import { map, catchError, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private service = inject(GamexidService);
  private workspace = inject(Workspace);
  canActivateChild() {
    return this.canActivate();
  }
  canActivate() {
    return this.service.session().pipe(
      map((user) => {
        this.workspace.setUser(user);
        return true;
      }),
      catchError(() => of(this.router.parseUrl('/login'))),
    );
  }
}
