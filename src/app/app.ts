import {
  Component,
  inject,
  signal,
  computed,
  effect,
  HostListener,
  ElementRef,
  viewChild,
  afterNextRender,
  Injector,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, timer } from 'rxjs';
import { animate, stagger, createTimeline } from 'animejs';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Icon } from './shared/icon';
import { GamexidLogo } from './shared/logo';
import { Workspace } from './core/workspace';
import { NetActivity } from './core/net-activity';
import { InventoryStore } from './core/inventory-store';
import { GamexidService } from './services-gamexid/gamexid-service';
import { reducedMotion } from './shared/anim';

interface NavItem {
  url: string;
  icon: string;
  name: string;
  short: string;
  key: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, ToastModule, TooltipModule, Icon, GamexidLogo],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly workspace = inject(Workspace);
  readonly net = inject(NetActivity);
  private store = inject(InventoryStore);
  private router = inject(Router);
  private data = inject(GamexidService);
  private host = inject(ElementRef<HTMLElement>);
  private injector = inject(Injector);
  private pill = viewChild<ElementRef<HTMLElement>>('pill');
  private loadbar = viewChild<ElementRef<HTMLElement>>('loadbar');
  readonly url = signal(this.router.url);
  readonly open = signal(false);
  readonly login = computed(() => this.url().startsWith('/login'));
  private introPlayed = false;
  readonly navigation: NavItem[] = [
    { url: '/dashboard', icon: 'dashboard', name: 'Centro de operaciones', short: 'Operaciones', key: '1' },
    { url: '/ingresos', icon: 'scan', name: 'Ingreso de mercadería', short: 'Ingresos', key: '2' },
    { url: '/productos', icon: 'package', name: 'Catálogo de productos', short: 'Productos', key: '3' },
    { url: '/sedes', icon: 'pin', name: 'Red de sedes', short: 'Sedes', key: '4' },
    { url: '/movimientos', icon: 'history', name: 'Auditoría de movimientos', short: 'Movimientos', key: '5' },
    { url: '/sucursales', icon: 'file', name: 'Pedidos e ingesta de remitos', short: 'Pedidos', key: '6' },
    { url: '/auditoria', icon: 'shield', name: 'Linaje y devoluciones', short: 'Linaje', key: '7' },
    { url: '/integracion', icon: 'plug', name: 'Integración GamingCity', short: 'GC-API', key: '8' },
  ];
  readonly current = computed(() => this.navigation.find((n) => this.url().startsWith(n.url)));
  readonly title = computed(() => this.current()?.name || 'Gamexid');

  constructor() {
    document.documentElement.classList.add('gamexid-dark');
    document.documentElement.lang = 'es';
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        const previous = this.url();
        this.url.set(e.urlAfterRedirects);
        if (this.login()) {
          this.store.reset();
          return;
        }
        this.workspace.refreshStatus();
        this.store.start();
        if (innerWidth < 1024) this.open.set(false);
        // Wait for the shell and routerLinkActive to render before measuring.
        afterNextRender(
          () => {
            this.movePill(previous.startsWith('/login') || !this.introPlayed);
            if (!this.introPlayed) this.playIntro();
            else this.enterContent();
          },
          { injector: this.injector },
        );
      });
    timer(30000, 30000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!this.login()) this.workspace.refreshStatus();
      });
    // Load bar follows real pending /api requests.
    effect(() => {
      const busy = this.net.busy();
      const bar = this.loadbar()?.nativeElement;
      if (!bar || reducedMotion()) return;
      if (busy) animate(bar, { scaleX: [0, 0.7], opacity: [0, 1], duration: 500, ease: 'outQuad' });
      else
        animate(bar, {
          scaleX: 1,
          duration: 180,
          ease: 'outQuad',
          onComplete: () => animate(bar, { opacity: 0, duration: 250 }),
        });
    });
    afterNextRender(() => this.movePill(true));
  }

  private q<T extends Element = HTMLElement>(sel: string) {
    return Array.from((this.host.nativeElement as HTMLElement).querySelectorAll<T>(sel));
  }
  private movePill(instant: boolean) {
    const pill = this.pill()?.nativeElement;
    const active = this.q('.nav-item.active')[0];
    if (!pill) return;
    if (!active) {
      pill.style.opacity = '0';
      return;
    }
    pill.style.opacity = '1';
    if (instant || reducedMotion()) {
      pill.style.transform = `translateY(${active.offsetTop}px)`;
      return;
    }
    animate(pill, { translateY: active.offsetTop, duration: 450, ease: 'outBack(1.4)' });
  }
  private playIntro() {
    this.introPlayed = true;
    if (reducedMotion()) return;
    // Inline transforms are cleared afterwards so the CSS mobile drawer keeps control of the rail.
    const tl = createTimeline({
      defaults: { ease: 'outExpo' },
      onComplete: () =>
        this.q('.rail, .topbar, .rail .nav-item').forEach((el) => {
          el.style.removeProperty('transform');
          el.style.removeProperty('opacity');
        }),
    });
    if (innerWidth >= 1024)
      tl.add(this.q('.rail'), { translateX: [-40, 0], opacity: [0, 1], duration: 600 }, 0).add(
        this.q('.rail .nav-item'),
        { translateX: [-12, 0], opacity: [0, 1], delay: stagger(35), duration: 500 },
        150,
      );
    tl.add(this.q('.topbar'), { translateY: [-12, 0], opacity: [0, 1], duration: 500 }, 80);
    this.enterContent(200);
  }
  private enterContent(start = 0) {
    const page = this.q('.workspace-content')[0];
    if (!page || reducedMotion()) return;
    animate(page, { opacity: [0, 1], translateY: [10, 0], duration: 450, delay: start, ease: 'outExpo' });
  }

  netOk() {
    const s = this.net.last()?.status || 0;
    return s >= 200 && s < 400;
  }
  @HostListener('document:keydown', ['$event'])
  shortcut(e: KeyboardEvent) {
    if (this.login() || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable], .p-dialog')) return;
    const item = this.navigation.find((n) => n.key === e.key);
    if (item) this.router.navigateByUrl(item.url);
  }
  @HostListener('document:keydown.escape') close() {
    this.open.set(false);
  }
  logout() {
    this.data.logout().subscribe({
      next: () => {
        this.workspace.setUser(null);
        sessionStorage.removeItem('logueado');
        this.introPlayed = false;
        this.router.navigateByUrl('/login');
      },
      error: () => this.workspace.notify('No se pudo cerrar la sesión. Revisá tu conexión.', 'error'),
    });
  }
}
