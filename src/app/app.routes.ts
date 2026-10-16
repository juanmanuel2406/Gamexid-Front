import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
export const routes: Routes = [
  { path: 'inicio', pathMatch: 'full', redirectTo: '' },
  { path: 'flujo', loadComponent: () => import('./features/flow/flow').then(m => m.Flow) },
  { path: 'marca', loadComponent: () => import('./features/brand/brand').then(m => m.Brand) },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'login',
    loadComponent: () => import('./components-gamexid/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      { path: 'integracion', pathMatch: 'full', redirectTo: 'productos' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components-gamexid/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'productos',
        loadComponent: () =>
          import('./components-gamexid/productos/productos').then((m) => m.Productos),
      },
      {
        path: 'ingresos',
        loadComponent: () =>
          import('./components-gamexid/ingresos/ingresos').then((m) => m.Ingresos),
      },
      {
        path: 'sucursales',
        loadComponent: () =>
          import('./components-gamexid/sucursales/sucursales').then((m) => m.Sucursales),
      },
      {
        path: 'sedes',
        loadComponent: () => import('./features/branches/branches').then((m) => m.Branches),
      },
      {
        path: 'movimientos',
        loadComponent: () => import('./features/movements/movements').then((m) => m.Movements),
      },
      {
        path: 'auditoria',
        loadComponent: () => import('./features/audit/audit').then((m) => m.Audit),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
