import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  input,
  viewChild,
} from '@angular/core';
import { createTimeline, svg, utils } from 'animejs';

let sequence = 0;

@Component({
  selector: 'gx-isotype',
  host: { '[attr.data-tone]': 'tone()' },
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg #svg viewBox="0 0 64 64" role="img" [attr.aria-label]="label()" [attr.aria-hidden]="label() ? null : 'true'">
      <defs>
        <linearGradient [attr.id]="gradId" gradientUnits="userSpaceOnUse" x1="14" y1="14" x2="50" y2="50">
          <stop offset="0" style="stop-color: var(--iso-g1)" />
          <stop offset="1" style="stop-color: var(--iso-g2)" />
        </linearGradient>
      </defs>
      <g class="frame" fill="none" style="stroke: var(--iso-corner)" [attr.stroke-width]="compact() ? 4.2 : 3.2" stroke-linecap="round" stroke-linejoin="round">
        <path class="corner" d="M6 18V10a4 4 0 0 1 4-4h8" data-dx="-1" data-dy="-1" />
        <path class="corner" d="M46 6h8a4 4 0 0 1 4 4v8" data-dx="1" data-dy="-1" />
        <path class="corner" d="M58 46v8a4 4 0 0 1-4 4h-8" data-dx="1" data-dy="1" />
        <path class="corner" d="M18 58h-8a4 4 0 0 1-4-4v-8" data-dx="-1" data-dy="1" />
      </g>
      <path class="g" d="M43.5 22.4 A15 15 0 1 0 47 32" fill="none" [attr.stroke]="'url(#' + gradId + ')'" [attr.stroke-width]="compact() ? 4.8 : 4" />
      @if (!compact()) {
        <line class="trace" x1="12" y1="32" x2="52" y2="32" style="stroke: var(--iso-laser)" stroke-width="1" opacity=".35" />
      }
      <line class="laser" x1="32" y1="32" x2="47" y2="32" style="stroke: var(--iso-laser)" [attr.stroke-width]="compact() ? 4.8 : 4" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-block; flex-shrink: 0; width: var(--gx-iso-size, 36px); height: var(--gx-iso-size, 36px);
      --iso-corner: #5b3fd0; --iso-g1: #1f1c16; --iso-g2: #4a32ad; --iso-laser: #3f7a52; --iso-glow: rgba(63, 122, 82, 0.45);
    }
    :host([data-tone='dark']) { --iso-corner: #a594f0; --iso-g1: #fbf9f4; --iso-g2: #d9d1f7; --iso-laser: #5fd08f; --iso-glow: rgba(95, 208, 143, 0.7); }
    svg { display: block; width: 100%; height: 100%; overflow: visible; }
    .laser { filter: drop-shadow(0 0 2px var(--iso-laser)) drop-shadow(0 0 6px var(--iso-glow)); }
  `,
})
export class GxIsotype implements AfterViewInit, OnDestroy {
  readonly animated = input(false);
  readonly loop = input(false);
  readonly compact = input(false);
  readonly label = input('');
  readonly tone = input<'light' | 'dark'>('light');
  readonly gradId = 'gx-iso-' + sequence++;
  private svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private anims: { pause: () => unknown }[] = [];

  ngAfterViewInit() {
    if (this.animated()) this.draw();
  }
  ngOnDestroy() {
    this.stop();
  }
  private stop() {
    this.anims.splice(0).forEach((a) => a.pause());
  }

  draw() {
    this.stop();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = this.svg().nativeElement;
    const corners = Array.from(root.querySelectorAll<SVGPathElement>('.corner'));
    const [arc] = svg.createDrawable(root.querySelector('.g')!);
    const [laser] = svg.createDrawable(root.querySelector('.laser')!);
    const traceEl = root.querySelector('.trace');
    utils.set(corners, { opacity: 0 });
    const tl = createTimeline({ defaults: { ease: 'outExpo' } });
    corners.forEach((c, i) => {
      const dx = Number(c.dataset['dx']) * 8, dy = Number(c.dataset['dy']) * 8;
      tl.add(c, { opacity: [0, 1], translateX: [dx, 0], translateY: [dy, 0], duration: 700 }, i * 70);
    });
    tl.add(arc, { draw: ['0 0', '0 1'], duration: 1100, ease: 'inOutQuart' }, 250);
    if (traceEl) {
      const [trace] = svg.createDrawable(traceEl as SVGLineElement);
      tl.add(trace, { draw: ['0.5 0.5', '0 1'], duration: 700, ease: 'outQuart' }, 1050);
    }
    tl.add(laser, { draw: ['0 0', '0 1'], duration: 500, ease: 'outQuart' }, 1250);
    this.anims.push(tl);
    if (this.loop()) {
      const pulse = createTimeline({ loop: true, loopDelay: 2400, autoplay: false });
      pulse.add(root.querySelector('.laser')!, {
        opacity: [{ to: 0.35, duration: 90 }, { to: 1, duration: 90 }, { to: 0.5, duration: 90 }, { to: 1, duration: 260 }],
      }, 0);
      if (traceEl) pulse.add(traceEl, { opacity: [{ to: 0.9, duration: 200 }, { to: 0.35, duration: 600 }] }, 0);
      tl.then(() => pulse.play());
      this.anims.push(pulse);
    }
  }
}
