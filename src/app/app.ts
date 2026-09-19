import { Component, OnInit, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { animate, stagger } from 'animejs';

import { rolLabel, FastScanService } from './services-fastscan/fastscan-service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: false,
})
export class App implements OnInit, OnDestroy {
  menuAbierto = false;
  esLogin = false;
  usuario = '';
  rol = '';
  inicial = '';
  lema = '';
  tema: 'dark' | 'light' = 'dark';
  idioma: 'es' | 'en' = 'es';
  mostrarVolverArriba = false;

  constructor(private router: Router, private service: FastScanService) {}

  get paginaActual(): string {
    const url = this.router.url;
    if (url.includes('ingresos')) return 'Ingresos de mercadería';
    if (url.includes('productos')) return 'Productos';
    if (url.includes('sucursales')) return 'Sucursales';
    return 'Dashboard';
  }

  get textos() {
    return this.idioma === 'en'
      ? { dashboard: 'Dashboard', products: 'Products', branches: 'Branches', entries: 'Receipts', newEntry: 'New receipt', online: 'Online' }
      : { dashboard: 'Dashboard', products: 'Productos', branches: 'Sucursales', entries: 'Ingresos', newEntry: 'Nuevo ingreso', online: 'En línea' };
  }

  esActivo(ruta: string): boolean {
    return this.router.url.includes(ruta);
  }

  ngOnInit(): void {
    this.esLogin = this.router.url.startsWith('/login');
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(event => {
      this.esLogin = event.urlAfterRedirects.startsWith('/login');
      this.usuario = sessionStorage.getItem('usuario') || '';
      this.inicial = this.usuario.charAt(0).toUpperCase();
      try { this.rol = rolLabel(JSON.parse(sessionStorage.getItem('userData') || '{}').role); } catch { this.rol = ''; }
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
    this.tema = 'dark';
    this.idioma = 'es';
    this.aplicarTema();

    setTimeout(() => {
      animate('.sidebar-item', {
        opacity: [0, 1],
        translateX: [-14, 0],
        delay: stagger(55),
        duration: 420,
        ease: 'outExpo',
      });
    }, 50);
  }

  ngOnDestroy(): void {
    /* sin timers que limpiar en el shell */
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  abrirMenuHover(): void {
    if (window.matchMedia('(hover: hover) and (min-width: 769px)').matches) this.menuAbierto = true;
  }

  cerrarMenuHover(): void {
    if (window.matchMedia('(hover: hover) and (min-width: 769px)').matches &&
        !document.querySelector('.sidebar')?.contains(document.activeElement)) this.menuAbierto = false;
  }

  salirFocoMenu(event: FocusEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) this.cerrarMenuHover();
  }

  toggleTema(): void {
    this.tema = this.tema === 'dark' ? 'light' : 'dark';
    localStorage.setItem('fs_tema', this.tema);
    this.aplicarTema();
  }

  cambiarIdioma(): void {
    this.idioma = this.idioma === 'es' ? 'en' : 'es';
    localStorage.setItem('fs_idioma', this.idioma);
    document.documentElement.lang = this.idioma;
  }

  onContenidoScroll(event: Event): void {
    this.mostrarVolverArriba = (event.target as HTMLElement).scrollTop > 280;
  }

  volverArriba(): void {
    document.querySelector('.contenido')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cerrarSesion(): void {
    this.service.logout().subscribe({
      next: () => {
    sessionStorage.removeItem('logueado');
    sessionStorage.removeItem('usuario');
    sessionStorage.removeItem('userData');
    this.router.navigate(['/login']);
      },
      error: () => window.alert('No se pudo cerrar la sesión. Revisá tu conexión y volvé a intentar.')
    });
  }

  ir(ruta: string): void {
    if (this.router.url !== '/' + ruta) {
      this.router.navigate([ruta]);
    }
  }

  private aplicarTema(): void {
    document.body.dataset['theme'] = this.tema;
    document.documentElement.lang = this.idioma;
  }
}
