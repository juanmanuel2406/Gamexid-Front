import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { animate, spring, stagger, svg, utils } from 'animejs';
import { GxIsotype } from '../../shared/gx-isotype';
import { Icon } from '../../shared/icon';

type Anim = { pause: () => unknown };

interface Kpi {
  cls: string;
  label: string;
  from: number;
  to: number;
  unit?: string;
  note: string;
  icon: 'pin' | 'scan' | 'database';
}

const CHECK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

@Component({
  selector: 'gx-home',
  standalone: true,
  imports: [RouterLink, GxIsotype, Icon],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements AfterViewInit, OnDestroy {
  private host = inject(ElementRef<HTMLElement>);
  private anims: Anim[] = [];
  private observers: IntersectionObserver[] = [];
  private cleanups: (() => void)[] = [];
  private token = 0;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly spring = spring({ mass: 1, stiffness: 80, damping: 10, velocity: 0 });

  readonly year = new Date().getFullYear();
  readonly kpis: Kpi[] = [
    { cls: 'kpi-counter-1', label: 'Sedes GamingCity', from: 0, to: 16, note: '16 sedes conectadas · Morón como depósito', icon: 'pin' },
    { cls: 'kpi-counter-2', label: 'Identificadores', from: 0, to: 3, note: 'EAN, SKU y número de serie', icon: 'scan' },
    { cls: 'kpi-counter-3', label: 'Base central', from: 0, to: 1, note: 'Inventario y pedidos en MySQL', icon: 'database' },
  ];
  readonly stock = [
    { name: 'Belgrano', value: 42 },
    { name: 'Palermo', value: 37 },
    { name: 'Unicenter', value: 31 },
    { name: 'La Plata', value: 18 },
    { name: 'Mendoza', value: 4 },
  ];
  /** Real GamingCity branches (Gamexid-Back BranchCatalog), colored by region. */
  readonly regions = [
    { key: 'dep', label: 'Depósito central', color: 'var(--k-brand)' },
    { key: 'caba', label: 'CABA', color: 'var(--k-sec-prod)' },
    { key: 'gba', label: 'Gran Buenos Aires', color: 'var(--k-ok)' },
    { key: 'int', label: 'Interior', color: 'var(--k-warn)' },
  ];
  readonly network = [
    ['DEP-CENTRAL', 'Morón', 'Depósito central', 'dep'], ['GX-UNICENTER', 'Unicenter', 'Martínez', 'gba'], ['GX-LAPLATA', 'La Plata', 'Gonnet', 'gba'],
    ['GX-SANMIGUEL', 'San Miguel', 'San Miguel', 'gba'], ['GX-SANISIDRO', 'San Isidro', 'San Isidro', 'gba'], ['GX-MERLO', 'Merlo', 'Merlo', 'gba'],
    ['GX-CATAN1', 'González Catán I', 'González Catán', 'gba'], ['GX-CATAN2', 'González Catán II', 'González Catán', 'gba'], ['GX-BELGRANO', 'Belgrano', 'CABA', 'caba'],
    ['GX-ABASTO', 'Abasto', 'CABA', 'caba'], ['GX-PALERMO', 'Palermo', 'CABA', 'caba'], ['GX-CABALLITO', 'Caballito', 'CABA', 'caba'],
    ['GX-LINIERS', 'Liniers', 'CABA', 'caba'], ['GX-MARDELPLATA', 'Mar del Plata', 'Buenos Aires', 'int'], ['GX-MENDOZA', 'Mendoza', 'Mendoza', 'int'],
    ['GX-CORRIENTES', 'Corrientes', 'Corrientes', 'int'],
  ].map(([code, name, city, region]) => ({ code, name, city, color: this.regions.find((r) => r.key === region)!.color }));
  readonly maxStock = Math.max(...this.stock.map((s) => s.value));

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

  ngAfterViewInit() {
    this.laser();
    this.scanLoop(++this.token);
    this.counters();
    this.architecture();
    this.microInteractions();
    this.brandReveal();
    this.networkReveal();
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
        animate(this.q('.bars rect'), { fill: [{ to: '#5fd08f', duration: 120 }, { to: '#e8e1d1', duration: 500 }], delay: stagger(6) });
      await this.sleep(350);
      state.textContent = 'COINCIDENCIA · EAN';
      state.classList.add('ok');
      await play(match, { opacity: [0.35, 1], scale: [0.98, 1], duration: 500, ease: 'outExpo' });
      for (const [i, s] of SERIALS.entries()) {
        await this.sleep(520);
        if (t !== this.token) return;
        const pill = document.createElement('span');
        pill.className = 'pill ok';
        pill.innerHTML = CHECK_SVG;
        pill.append(s);
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

  /**
   * Hero lockup: the isotype draws itself (GxIsotype); the wordmark is revealed left to right right after,
   * and the tagline fades in. Runs once on load (rare → delight is allowed).
   */
  private brandReveal() {
    if (this.reduced) return;
    const word = this.q('.hero-brand .gx-word b');
    const tag = this.q('.hero-brand .gx-word small');
    this.anims.push(
      animate(word, { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'], duration: 700, delay: 900, ease: 'outQuart' }),
      animate(tag, { opacity: [0, 1], translateY: [4, 0], duration: 400, delay: 1400, ease: 'outQuart' }),
    );
  }
  /** Network grid: branches appear in order with a short stagger when the section scrolls in. */
  private networkReveal() {
    const items = this.q('.red-grid .sede');
    if (this.reduced || !items.length) return;
    items.forEach((el) => (el.style.opacity = '0'));
    this.whenVisible(this.one('.red-grid'), () => {
      this.anims.push(animate(items, { opacity: [0, 1], translateY: [8, 0], duration: 420, delay: stagger(40), ease: 'outQuart' }));
    });
  }
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
    this.q('.btn').forEach((b) => bind(b, { scale: 1.02 }, { scale: 1 }));
    if (!this.reduced) this.anims.push(animate(this.q('.mini-bars .tr i'), { scaleX: [0, 1], delay: stagger(80, { start: 600 }), duration: 900, ease: 'outExpo' }));
  }
}
