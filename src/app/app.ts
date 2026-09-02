import { Component, OnInit, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { gsap } from 'gsap';

import { rolLabel } from './services-fastscan/fastscan-service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: false,
})
export class App implements OnInit, OnDestroy {
  menuAbierto = window.innerWidth > 768;
  esLogin = false;
  usuario = '';
  rol = '';
  inicial = '';
  lema = '';

  constructor(private router: Router) {}

  get paginaActual(): string {
    const url = this.router.url;
    if (url.includes('ingresos')) return 'Ingresos de mercadería';
    if (url.includes('productos')) return 'Productos';
    if (url.includes('sucursales')) return 'Sucursales';
    return 'Dashboard';
  }

  esActivo(ruta: string): boolean {
    return this.router.url.includes(ruta);
  }

  ngOnInit(): void {
    this.esLogin = this.router.url.startsWith('/login');
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(event => {
      this.esLogin = event.urlAfterRedirects.startsWith('/login');
      if (!this.esLogin && window.innerWidth <= 768) this.menuAbierto = false;
    });
    const name = sessionStorage.getItem('usuario') || '';
    const data = sessionStorage.getItem('userData');
    let role = 'Operator';
    if (data) {
      try {
        const parsed = JSON.parse(data);
        role = parsed.role || parsed.Role || 'Operator';
      } catch {
        /* ignore */
      }
    }
    this.usuario = name;
    this.rol = rolLabel(role);
    this.inicial = name.charAt(0).toUpperCase();
    this.lema = localStorage.getItem('fs_lema') || 'Gestión de inventario integral';

    // animación de entrada de la sidebar
    setTimeout(() => {
      gsap.from('.sidebar-item', { opacity: 0, x: -12, duration: 0.4, stagger: 0.06, ease: 'power2.out' });
    }, 50);
  }

  ngOnDestroy(): void {
    /* sin timers que limpiar en el shell */
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  cerrarSesion(): void {
    sessionStorage.removeItem('logueado');
    sessionStorage.removeItem('usuario');
    sessionStorage.removeItem('userData');
    this.router.navigate(['/login']);
  }

  ir(ruta: string): void {
    if (this.router.url !== '/' + ruta) {
      this.router.navigate([ruta]);
    }
  }
}
