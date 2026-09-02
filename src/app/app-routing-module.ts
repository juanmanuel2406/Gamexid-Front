import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { Login } from './components-fastscan/login/login';
import { Dashboard } from './components-fastscan/dashboard/dashboard';
import { Productos } from './components-fastscan/productos/productos';
import { Sucursales } from './components-fastscan/sucursales/sucursales';
import { Ingresos } from './components-fastscan/ingresos/ingresos';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'productos', component: Productos },
      { path: 'sucursales', component: Sucursales },
      { path: 'ingresos', component: Ingresos },
    ],
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutesModule {}
