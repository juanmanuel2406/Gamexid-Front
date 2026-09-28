import { Component, inject, signal, computed, DestroyRef, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, timer } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Icon } from './shared/icon';
import { Workspace } from './core/workspace';
import { FastScanService } from './services-fastscan/fastscan-service';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    ToastModule,
    TooltipModule,
    Icon,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly workspace = inject(Workspace);
  private router = inject(Router);
  private data = inject(FastScanService);
  private destroy = inject(DestroyRef);
  readonly url = signal(this.router.url);
  readonly open = signal(false);
  readonly login = computed(() => this.url().startsWith('/login'));
  readonly user = signal(sessionStorage.getItem('usuario') || 'Operador');
  readonly navigation = [
    { url: '/dashboard', icon: 'dashboard', name: 'Centro de operaciones', short: 'Resumen' },
    { url: '/ingresos', icon: 'scan', name: 'Terminal de ingreso', short: 'Escaneo' },
    { url: '/productos', icon: 'package', name: 'Catálogo de productos', short: 'Productos' },
    { url: '/sucursales', icon: 'file', name: 'Pedidos e ingesta', short: 'Pedidos' },
    { url: '/auditoria', icon: 'shield', name: 'Linaje y devoluciones', short: 'Auditoría' },
  ];
  readonly title = computed(
    () => this.navigation.find((n) => this.url().startsWith(n.url))?.short || 'Gamexid',
  );
  constructor() {
    document.documentElement.classList.add('gamexid-dark');
    document.documentElement.lang = 'es';
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects);
        this.user.set(sessionStorage.getItem('usuario') || 'Operador');
        if (!this.login()) this.workspace.refreshStatus();
        if (innerWidth < 1024) this.open.set(false);
      });
    timer(0, 30000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!this.login()) this.workspace.refreshStatus();
      });
  }
  hover(value: boolean) {
    if (matchMedia('(hover: hover) and (min-width: 1024px)').matches) this.open.set(value);
  }
  @HostListener('document:keydown.escape') close() {
    this.open.set(false);
  }
  logout() {
    this.data.logout().subscribe({
      next: () => {
        sessionStorage.removeItem('usuario');
        sessionStorage.removeItem('userData');
        sessionStorage.removeItem('logueado');
        this.router.navigateByUrl('/login');
      },
      error: () =>
        this.workspace.notify('No se pudo cerrar la sesión. Revisá tu conexión.', 'error'),
    });
  }
}
