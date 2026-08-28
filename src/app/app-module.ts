import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { App } from './app';
import { AppRoutesModule } from './app-routing-module';
import { Login } from './components-fastscan/login/login';
import { Dashboard } from './components-fastscan/dashboard/dashboard';
import { Productos } from './components-fastscan/productos/productos';
import { Sucursales } from './components-fastscan/sucursales/sucursales';
import { Ingresos } from './components-fastscan/ingresos/ingresos';

@NgModule({
  declarations: [App, Login, Dashboard, Productos, Sucursales, Ingresos],
  imports: [BrowserModule, FormsModule, HttpClientModule, AppRoutesModule],
  providers: [],
  bootstrap: [App],
})
export class AppModule {}
