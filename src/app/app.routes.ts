import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components-fastscan/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      { path: 'integracion', loadComponent: () => import('./features/integration/integration').then((m) => m.Integration) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components-fastscan/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'productos',
        loadComponent: () =>
          import('./components-fastscan/productos/productos').then((m) => m.Productos),
      },
      {
        path: 'ingresos',
        loadComponent: () =>
          import('./components-fastscan/ingresos/ingresos').then((m) => m.Ingresos),
      },
      {
        path: 'sucursales',
        loadComponent: () =>
          import('./components-fastscan/sucursales/sucursales').then((m) => m.Sucursales),
      },
      {
        path: 'auditoria',
        loadComponent: () => import('./features/audit/audit').then((m) => m.Audit),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
