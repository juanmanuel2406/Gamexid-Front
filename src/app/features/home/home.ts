import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { animate, spring, stagger, svg, utils } from 'animejs';
import { GxIsotype } from '../../shared/gx-isotype';

type Anim = { pause: () => unknown };

interface Kpi {
  cls: string;
  label: string;
  from: number;
  to: number;
  unit?: string;
  note: string;
  icon: 'pin' | 'scan' | 'db';
}

/** Public landing page (route "/"). Every animation lives in ngAfterViewInit and is released in ngOnDestroy. */
@Component({
  selector: 'gx-home',
  standalone: true,
  imports: [RouterLink, GxIsotype],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements AfterViewInit, OnDestroy {
  private host = inject(ElementRef<HTMLElement>);
  private http = inject(HttpClient);
  private anims: Anim[] = [];
  private observers: IntersectionObserver[] = [];
  private cleanups: (() => void)[] = [];
  private token = 0;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly spring = spring({ mass: 1, stiffness: 80, damping: 10, velocity: 0 });

  readonly api = signal<'checking' | 'online' | 'preview'>('checking');
  readonly year = new Date().getFullYear();
  readonly kpis: Kpi[] = [
    { cls: 'kpi-counter-1', label: 'Sedes Gaming City', from: 0, to: 16, note: 'Depósito central + 15 locales conectados', icon: 'pin' },
    { cls: 'kpi-counter-2', label: 'Escaneo por cámara', from: 0, to: 60, unit: 'fps', note: 'Lectura continua del visor', icon: 'scan' },
    { cls: 'kpi-counter-3', label: 'Respuesta Aiven MySQL', from: 100, to: 10, unit: 'ms', note: 'Consulta de serial en la base', icon: 'db' },
  ];
  readonly stock = [
    { name: 'Belgrano', value: 42 },
    { name: 'Palermo', value: 37 },
    { name: 'Unicenter', value: 31 },
    { name: 'La Plata', value: 18 },
    { name: 'Mendoza', value: 4 },
  ];
  readonly maxStock = Math.max(...this.stock.map((s) => s.value));
  /** EAN-13 style bars for the viewfinder (guard bars are taller). */
  readonly bars = (() => {
    const out: { x: number; w: number; h: number }[] = [];
    const W = [2, 2, 4, 6, 2, 4, 2, 3, 2, 5];
    let x = 6, i = 0;
    while (x < 282) {
      const w = W[i % W.length];
      const guard = i < 3 || (i > 24 && i < 28) || x > 272;
      out.push({ x, w, h: guard ? 96 : 86 });
      x += w + [2, 3, 2, 4][i % 4];
      i++;
    }
    return out;
  })();

  constructor() {
    this.http
      .get<{ status?: string }>('/api/access/health')
      .pipe(timeout(4000))
      .subscribe({
        next: (r) => this.api.set(r?.status === 'ok' ? 'online' : 'preview'),
        error: () => this.api.set('preview'),
      });
  }

  ngAfterViewInit() {
    this.laser();
    this.scanLoop(++this.token);
    this.counters();
    this.architecture();
    this.microInteractions();
  }

  ngOnDestroy() {
    this.token++;
    this.anims.splice(0).forEach((a) => a.pause());
    this.observers.splice(0).forEach((o) => o.disconnect());
    this.cleanups.splice(0).forEach((fn) => fn());
  }

  private q<T extends Element = HTMLElement>(sel: string): T[] {
    return Array.from((this.host.nativeElement as HTMLElement).querySelectorAll<T>(sel));
  }
  private one<T extends Element = HTMLElement>(sel: string): T {
    return (this.host.nativeElement as HTMLElement).querySelector<T>(sel)!;
  }
  private whenVisible(el: Element, fn: () => void) {
    if (!('IntersectionObserver' in window)) return fn();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    this.observers.push(io);
  }
  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** A. Laser sweeping the hero viewfinder. */
  private laser() {
    if (this.reduced) return;
    const travel = this.one('.viewfinder').clientHeight - 30;
    this.anims.push(
      animate(this.q('.laser-line'), {
        translateY: ['0px', `${travel}px`],
        opacity: [{ from: 0.3, to: 1, duration: 1000 }, { to: 0.3, duration: 1000 }],
        duration: 2000,
        ease: 'inOutQuad',
        alternate: true,
        loop: true,
      }),
      animate(this.q('.live-dot'), { opacity: [1, 0.3], duration: 800, alternate: true, loop: true, ease: 'inOutSine' }),
    );
  }

  /** Live scanning demo: EAN typed in, match card, three serials verified, toast. */
  private async scanLoop(t: number) {
    const EAN = '7798114620015';
    const SERIALS = ['PS5A0001', 'PS5A0002', 'PS5A0003'];
    const typed = this.one('.typed'), ph = this.one('.ph'), match = this.one('.match');
    const serials = this.one('.serials'), toast = this.one('.term-toast'), state = this.one('.scan-state'), count = this.one('.count');
    const setCount = (n: number) => (count.textContent = String(n).padStart(2, '0'));
    const play = (el: Element, p: Record<string, unknown>) =>
      new Promise<void>((res) => (this.reduced ? res() : animate(el, { ...p, onComplete: () => res() })));
    do {
      typed.textContent = '';
      ph.hidden = false;
      serials.replaceChildren();
      setCount(0);
      state.textContent = 'ESPERANDO LECTURA';
      state.classList.remove('ok');
      if (!this.reduced) utils.set(match, { opacity: 0.35 });
      await this.sleep(900);
      if (t !== this.token) return;
      state.textContent = 'LEYENDO EAN-13';
      ph.hidden = true;
      for (const ch of EAN) {
        if (t !== this.token) return;
        typed.textContent += ch;
        await this.sleep(this.reduced ? 0 : 42);
      }
      if (!this.reduced)
        animate(this.q('.bars rect'), { fill: [{ to: '#34d399', duration: 120 }, { to: '#e2e8f0', duration: 500 }], delay: stagger(6) });
      await this.sleep(350);
      state.textContent = 'COINCIDENCIA · EAN';
      state.classList.add('ok');
      await play(match, { opacity: [0.35, 1], scale: [0.98, 1], duration: 500, ease: 'outExpo' });
      for (const [i, s] of SERIALS.entries()) {
        await this.sleep(520);
        if (t !== this.token) return;
        const pill = document.createElement('span');
        pill.className = 'pill ok';
        pill.textContent = '✓ ' + s;
        serials.appendChild(pill);
        if (!this.reduced) animate(pill, { opacity: [0, 1], scale: [0.6, 1], duration: 600, ease: this.spring });
        setCount(i + 1);
        state.textContent = `SERIAL ${i + 1}/3 VERIFICADO`;
      }
      await this.sleep(700);
      state.textContent = 'INGRESO CONFIRMADO';
      await play(toast, { opacity: [0, 1], translateY: [16, 0], duration: 500, ease: 'outExpo' });
      await this.sleep(2200);
      await play(toast, { opacity: 0, translateY: 10, duration: 300, ease: 'inQuad' });
      if (this.reduced) return;
      await this.sleep(500);
    } while (t === this.token);
  }

  /** B. KPI counters when the row enters the viewport. */
  private counters() {
    this.whenVisible(this.one('.kpis'), () => {
      this.kpis.forEach((k, i) => {
        const el = this.one(`.${k.cls}`);
        if (this.reduced) return void (el.textContent = String(k.to));
        el.textContent = String(k.from);
        this.anims.push(animate(el, { innerHTML: [k.from, k.to], modifier: utils.round(0), duration: 1500, delay: i * 120, ease: 'outExpo' }));
      });
      if (!this.reduced) this.anims.push(animate(this.q('.kpi .bar i'), { scaleX: [0, 1], duration: 1500, delay: stagger(120), ease: 'outExpo' }));
    });
  }

  /** C. Architecture: draw connections, then send readings along them. */
  private architecture() {
    this.whenVisible(this.one('.arch'), () => {
      if (this.reduced) return;
      this.anims.push(
        animate(svg.createDrawable(this.q<SVGPathElement>('.architecture-path')), { draw: ['0 0', '0 1'], ease: 'inOutSine', duration: 1500, delay: stagger(200) }),
        animate(this.q('.arch .node'), { opacity: [0, 1], translateY: [10, 0], duration: 700, delay: stagger(90), ease: 'outExpo' }),
      );
      const layer = this.one<SVGGElement>('.packets');
      const send = (path: SVGPathElement, delay: number) => {
        const len = path.getTotalLength();
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('r', '4');
        dot.setAttribute('class', 'packet');
        dot.setAttribute('opacity', '0');
        layer.appendChild(dot);
        const o = { t: 0 };
        this.anims.push(animate(o, {
          t: 1, duration: 1400, delay, loop: true, loopDelay: 1600, ease: 'inOutSine',
          onUpdate: () => {
            const p = path.getPointAtLength(o.t * len);
            dot.setAttribute('cx', String(p.x));
            dot.setAttribute('cy', String(p.y));
            dot.setAttribute('opacity', Math.sin(o.t * Math.PI).toFixed(2));
          },
        }));
      };
      const paths = this.q<SVGPathElement>('.architecture-path');
      const timer = setTimeout(() => [1, 0, 2, 3].forEach((i, n) => send(paths[i], n * 700)), 1700);
      this.cleanups.push(() => clearTimeout(timer));
    });
  }

  /** D. Bento cards and buttons: spring scale + glow on hover. */
  private microInteractions() {
    const bind = (el: HTMLElement, enter: Record<string, unknown>, leave: Record<string, unknown>, hot = false) => {
      const on = () => { if (hot) el.classList.add('hot'); if (!this.reduced) animate(el, { ...enter, duration: 700, ease: this.spring }); };
      const off = () => { if (hot) el.classList.remove('hot'); if (!this.reduced) animate(el, { ...leave, duration: 700, ease: this.spring }); };
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      };
      el.addEventListener('pointerenter', on);
      el.addEventListener('pointerleave', off);
      if (hot) el.addEventListener('pointermove', move, { passive: true });
      this.cleanups.push(() => {
        el.removeEventListener('pointerenter', on);
        el.removeEventListener('pointerleave', off);
        el.removeEventListener('pointermove', move);
      });
    };
    this.q('.card').forEach((c) => bind(c, { scale: 1.02, translateY: -4 }, { scale: 1, translateY: 0 }, true));
    this.q('.btn').forEach((b) => bind(b, { scale: 1.04 }, { scale: 1 }));
    if (!this.reduced) this.anims.push(animate(this.q('.mini-bars .tr i'), { scaleX: [0, 1], delay: stagger(80, { start: 600 }), duration: 900, ease: 'outExpo' }));
  }
}
