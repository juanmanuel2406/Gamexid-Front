import { Directive, ElementRef, OnDestroy, effect, inject, input } from '@angular/core';
import { animate, createTimeline, stagger } from 'animejs';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

type Anim = { pause: () => unknown };

/** Staggered entrance for a set of elements. Elements stay visible if motion is reduced. */
export function enterStagger(targets: Element[] | NodeListOf<Element>, start = 0, step = 50): Anim | undefined {
  const list = Array.from(targets);
  if (!list.length || reducedMotion()) return;
  return animate(list, {
    translateY: [14, 0],
    opacity: [0, 1],
    delay: stagger(step, { start }),
    duration: 550,
    ease: 'outExpo',
  });
}

export function growBars(targets: Element[], axis: 'x' | 'y', start = 200, step = 40): Anim | undefined {
  if (!targets.length || reducedMotion()) return;
  return animate(targets, {
    [axis === 'x' ? 'scaleX' : 'scaleY']: [0, 1],
    delay: stagger(step, { start }),
    duration: 750,
    ease: 'outExpo',
  });
}

export function shake(el?: Element | null) {
  if (!el || reducedMotion()) return;
  animate(el, {
    translateX: [{ to: -6, duration: 50 }, { to: 6, duration: 70 }, { to: -3, duration: 70 }, { to: 0, duration: 80 }],
    ease: 'inOutSine',
  });
}

export function flash(el?: Element | null, color = 'rgba(155,56,238,.22)') {
  if (!el || reducedMotion()) return;
  animate(el, { backgroundColor: [color, 'rgba(0,0,0,0)'], duration: 1200, ease: 'outQuad' });
}

/** Unfold a newly inserted element from 0 height (feed items, result panels). */
export function unfold(el?: HTMLElement | null) {
  if (!el || reducedMotion()) return;
  const h = el.scrollHeight;
  animate(el, {
    height: [0, h],
    opacity: [0, 1],
    duration: 450,
    ease: 'outExpo',
    onComplete: () => (el.style.height = ''),
  });
}

/** A label that flies from one rect to another (e.g. "added to receipt"). */
export function flyChip(from: DOMRect, to: DOMRect, label: string): Promise<void> {
  if (reducedMotion()) return Promise.resolve();
  const g = document.createElement('div');
  g.className = 'gx-ghost-chip';
  g.textContent = label;
  g.style.left = from.left + 'px';
  g.style.top = from.top + 'px';
  document.body.appendChild(g);
  const dx = to.left + to.width / 2 - from.left - g.offsetWidth / 2;
  const dy = to.top - from.top;
  return new Promise((resolve) => {
    createTimeline({ onComplete: () => { g.remove(); resolve(); } })
      .add(g, { translateX: dx, duration: 560, ease: 'inOutQuart' }, 0)
      .add(g, { translateY: [{ to: Math.min(dy, 0) - 50, duration: 280, ease: 'outQuad' }, { to: dy, duration: 280, ease: 'inQuad' }] }, 0)
      .add(g, { scale: [1, 0.4], opacity: [1, 0], duration: 160, ease: 'inQuad' }, 460);
  });
}

/** Floating "+N" over an element after a successful write. */
export function burst(rect: DOMRect, text: string) {
  if (reducedMotion()) return;
  const el = document.createElement('div');
  el.className = 'gx-burst';
  el.textContent = text;
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';
  document.body.appendChild(el);
  animate(el, {
    translateY: [0, -44],
    opacity: [{ to: 1, duration: 150 }, { to: 0, duration: 500, delay: 350 }],
    duration: 1000,
    ease: 'outExpo',
    onComplete: () => el.remove(),
  });
}

/** FLIP: call before a list re-renders, then call the returned function after it did. */
export function flipList(container: HTMLElement | null | undefined, key: string) {
  if (!container || reducedMotion()) return () => {};
  const before = new Map(
    Array.from(container.querySelectorAll<HTMLElement>(`[${key}]`)).map((el) => [el.getAttribute(key), el.getBoundingClientRect().top]),
  );
  return () => {
    container.querySelectorAll<HTMLElement>(`[${key}]`).forEach((el) => {
      const prev = before.get(el.getAttribute(key));
      if (prev == null) return;
      const dy = prev - el.getBoundingClientRect().top;
      if (dy) animate(el, { translateY: [dy, 0], duration: 500, ease: 'outExpo' });
    });
  };
}

/** Animated number: `<span [gxCount]="value"></span>`. Counts from the previous value. */
@Directive({ selector: '[gxCount]', standalone: true })
export class CountUp implements OnDestroy {
  readonly gxCount = input<number>(0);
  readonly gxPad = input(0);
  private el = inject(ElementRef<HTMLElement>);
  private current = 0;
  private anim?: Anim;
  private format = new Intl.NumberFormat('es-AR');
  constructor() {
    effect(() => {
      const to = Number(this.gxCount()) || 0;
      const pad = this.gxPad();
      const render = (v: number) => {
        const n = Math.round(v);
        this.el.nativeElement.textContent = pad ? String(n).padStart(pad, '0') : this.format.format(n);
      };
      this.anim?.pause();
      if (reducedMotion()) {
        this.current = to;
        render(to);
        return;
      }
      const o = { v: this.current };
      this.anim = animate(o, {
        v: to,
        duration: 900,
        ease: 'outExpo',
        onUpdate: () => { this.current = o.v; render(o.v); },
        onComplete: () => { render(to); this.current = to; },
      });
    });
  }
  ngOnDestroy() {
    this.anim?.pause();
  }
}
