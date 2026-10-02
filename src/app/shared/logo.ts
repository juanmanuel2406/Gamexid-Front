import {
  Component,
  Input,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { animate, createTimeline, stagger, utils } from 'animejs';
let sequence = 0;
@Component({
  selector: 'gx-logo',
  standalone: true,
  template:
    '<svg #canvas [attr.viewBox]="compact ? \'190 80 365 285\' : \'150 60 444 440\'" role="img" aria-label="Gamexid" preserveAspectRatio="xMidYMid meet"></svg>',
  styles: [
    `
      :host {
        display: block;
        flex-shrink: 0;
      }
      svg {
        display: block;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      :host ::ng-deep .ltr {
        transform-box: fill-box;
        transform-origin: 50% 100%;
      }
      :host ::ng-deep .bone,
      :host ::ng-deep .head {
        transform-box: fill-box;
        transform-origin: center;
      }
      :host ::ng-deep .head {
        transform-origin: left center;
      }
      :host ::ng-deep text {
        font-family: Inter, Arial, sans-serif;
        font-weight: 700;
      }
    `,
  ],
})
export class GamexidLogo implements AfterViewInit, OnChanges, OnDestroy {
  @Input() compact = false;
  @Input() animated = true;
  @ViewChild('canvas') canvas!: ElementRef<SVGSVGElement>;
  private ready = false;
  private motions: { revert: () => void }[] = [];
  private readonly id = 'gamexid-vector-' + sequence++;
  private preference = matchMedia('(prefers-reduced-motion: reduce)');
  private onPreference = () => this.render();
  ngAfterViewInit() {
    this.ready = true;
    this.preference.addEventListener('change', this.onPreference);
    this.render();
  }
  ngOnChanges() {
    if (this.ready) this.render();
  }
  ngOnDestroy() {
    this.preference.removeEventListener('change', this.onPreference);
    this.stop();
  }
  private stop() {
    this.motions
      .splice(0)
      .reverse()
      .forEach((m) => m.revert());
  }
  private render() {
    this.stop();
    const svg = this.canvas.nativeElement,
      compact = this.compact,
      id = this.id;
    svg.replaceChildren();
    const NS = 'http://www.w3.org/2000/svg';
    const mk = <K extends keyof SVGElementTagNameMap>(
      t: K,
      a: Record<string, string | number>,
      p: Element,
    ): SVGElementTagNameMap[K] => {
      const e = document.createElementNS(NS, t);
      for (const k in a) e.setAttribute(k, String(a[k]));
      p.appendChild(e);
      return e;
    };
    const defs = mk('defs', {}, svg);
    const grad = mk(
      'linearGradient',
      { id: id + '-gradient', gradientUnits: 'userSpaceOnUse', x1: 240, y1: 0, x2: 514, y2: 0 },
      defs,
    );
    for (const [offset, color] of [
      ['0', '#ff00e6'],
      ['.45', '#9b38ee'],
      ['1', '#3f6ee0'],
    ])
      mk('stop', { offset, 'stop-color': color }, grad);
    const filter = mk(
      'filter',
      { id: id + '-glow', x: '-20%', y: '-20%', width: '140%', height: '140%' },
      defs,
    );
    const blur = mk(
      'feGaussianBlur',
      { in: 'SourceGraphic', stdDeviation: 1, result: 'b' },
      filter,
    );
    const merge = mk('feMerge', {}, filter);
    mk('feMergeNode', { in: 'b' }, merge);
    mk('feMergeNode', { in: 'SourceGraphic' }, merge);
    const mark = mk('g', { 'data-part': 'mark', filter: `url(#${id}-glow)` }, svg);
    const ms = mk(
      'text',
      {
        x: 372,
        y: 418,
        'text-anchor': 'middle',
        'font-size': 58,
        textLength: 327,
        lengthAdjust: 'spacingAndGlyphs',
        visibility: 'hidden',
      },
      svg,
    );
    ms.textContent = 'GAMEXID';
    const word = mk('g', { 'data-part': 'word' }, svg);
    const stops = [
      [255, 0, 230],
      [155, 56, 238],
      [63, 110, 224],
    ];
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    function col(x: number) {
      let t = Math.min(1, Math.max(0, (x - 240) / 274)),
        k = t < 0.45 ? 0 : 1,
        u = k ? (t - 0.45) / 0.55 : t / 0.45,
        a = stops[k],
        b = stops[k + 1];
      return `rgb(${[0, 1, 2].map((i) => Math.round(lerp(a[i], b[i], u))).join(',')})`;
    }
    const bez = (p: number[][], t: number) => {
      const m = 1 - t;
      return [0, 1].map(
        (i) =>
          m * m * m * p[0][i] +
          3 * m * m * t * p[1][i] +
          3 * m * t * t * p[2][i] +
          t * t * t * p[3][i],
      );
    };

    // curve, head radius, tail end x (0 = none), second head bulb, items [x, length, thickness] (length 0 = round bulb)
    const L: { p: number[][]; r: number; tail: number; dbl?: number[]; it: number[][] }[] = [
      {
        p: [
          [283, 130],
          [350, 148],
          [430, 150],
          [512, 190],
        ],
        r: 15,
        tail: 356,
        it: [
          [362, 0, 17],
          [388, 24, 11],
          [412, 15, 8],
          [438, 14, 7],
          [456, 10, 6],
          [472, 8, 5],
          [486, 7, 4.5],
          [498, 6, 4],
          [508, 5, 3.5],
        ],
      },
      {
        p: [
          [308, 184],
          [380, 190],
          [440, 190],
          [508, 205],
        ],
        r: 14,
        tail: 470,
        it: [
          [478, 7, 6],
          [489, 7, 5],
          [498, 6, 4.5],
          [506, 5, 4],
        ],
      },
      {
        p: [
          [281, 227],
          [370, 232],
          [440, 205],
          [508, 214],
        ],
        r: 17,
        tail: 0,
        dbl: [37, 13],
        it: [
          [352, 30, 11],
          [405, 24, 9],
          [438, 18, 8],
          [465, 14, 8],
          [478, 10, 7],
          [490, 8, 6],
          [500, 7, 5],
          [508, 6, 4],
        ],
      },
      {
        p: [
          [292, 272],
          [350, 262],
          [410, 250],
          [508, 233],
        ],
        r: 14,
        tail: 410,
        it: [
          [418, 22, 9],
          [440, 16, 8],
          [468, 12, 7],
          [485, 9, 6],
          [498, 8, 5],
          [508, 6, 4],
        ],
      },
      {
        p: [
          [242, 322],
          [320, 312],
          [400, 275],
          [510, 250],
        ],
        r: 16,
        tail: 378,
        it: [
          [386, 14, 9],
          [410, 22, 10],
          [450, 18, 9],
          [468, 10, 7],
          [482, 8, 6],
          [496, 7, 5],
          [508, 6, 4],
        ],
      },
    ];

    L.forEach((ln, li) => {
      const g = mk('g', {}, mark);
      const tab: { s: number; x: number; y: number }[] = [];
      let s = 0,
        pr = bez(ln.p, 0);
      tab.push({ s: 0, x: pr[0], y: pr[1] });
      for (let i = 1; i <= 400; i++) {
        const q = bez(ln.p, i / 400);
        s += Math.hypot(q[0] - pr[0], q[1] - pr[1]);
        tab.push({ s, x: q[0], y: q[1] });
        pr = q;
      }
      const atS = (v: number) => {
        let i = 1;
        while (i < tab.length - 1 && tab[i].s < v) i++;
        const a = tab[i - 1],
          b = tab[i],
          f = (v - a.s) / (b.s - a.s || 1);
        return {
          x: lerp(a.x, b.x, f),
          y: lerp(a.y, b.y, f),
          ang: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
        };
      };
      const sOfX = (x: number) => {
        let best = tab[0];
        for (const q of tab) if (Math.abs(q.x - x) < Math.abs(best.x - x)) best = q;
        return best.s;
      };

      // head + tapering tail
      const hg = mk('g', { class: 'head' }, g);
      const sEnd = ln.tail ? sOfX(ln.tail) : ln.dbl ? ln.dbl[0] + ln.dbl[1] : ln.r * 2;
      const w0 = ln.r * 1.05,
        tau = ln.r * (ln.tail ? 3.4 : 1.2),
        up = [],
        dn = [];
      for (let v = 0; v <= sEnd; v += 3) {
        const a = atS(v),
          b = atS(v + 1),
          nx = -(b.y - a.y),
          ny = b.x - a.x,
          n = Math.hypot(nx, ny) || 1;
        const w = (ln.tail ? 1.3 : 2.5) + (w0 - (ln.tail ? 1.3 : 2.5)) * Math.exp(-v / tau);
        up.push([a.x + ((nx / n) * w) / 2, a.y + ((ny / n) * w) / 2]);
        dn.push([a.x - ((nx / n) * w) / 2, a.y - ((ny / n) * w) / 2]);
      }
      const pts = up.concat(dn.reverse());
      mk(
        'path',
        {
          d: 'M' + pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('L') + 'Z',
          fill: `url(#${id}-gradient)`,
        },
        hg,
      );
      const h0 = atS(0);
      mk('circle', { cx: h0.x, cy: h0.y, r: ln.r, fill: `url(#${id}-gradient)` }, hg);
      if (ln.dbl) {
        const c = atS(ln.dbl[0]);
        mk('circle', { cx: c.x, cy: c.y, r: ln.dbl[1], fill: `url(#${id}-gradient)` }, hg);
      }

      // segments
      ln.it.forEach(([x, len, th]) => {
        const a = atS(sOfX(x)),
          o = mk(
            'g',
            {
              transform: `translate(${a.x.toFixed(1)},${a.y.toFixed(1)}) rotate(${a.ang.toFixed(1)})`,
            },
            g,
          );
        const b = mk('g', { class: 'bone', 'data-x': x, 'data-l': li }, o),
          f = col(x),
          r = th / 2;
        if (!len) {
          mk('circle', { r, fill: f }, b);
          return;
        }
        const e = len / 2 - r;
        mk('circle', { cx: -e, r, fill: f }, b);
        mk('circle', { cx: e, r, fill: f }, b);
        mk('rect', { x: -e, y: -th * 0.19, width: 2 * e, height: th * 0.38, fill: f }, b);
      });
    });

    // letters
    const W = compact ? '' : 'GAMEXID';
    for (let i = 0; i < W.length; i++) {
      const ex = ms.getExtentOfChar(i),
        t = mk(
          'text',
          {
            class: 'ltr',
            x: ex.x,
            y: 418,
            'font-size': 58,
            fill: '#fff',
            textLength: ex.width,
            lengthAdjust: 'spacingAndGlyphs',
          },
          word,
        );
      t.textContent = W[i];
      t.dataset['c'] = col(255 + i * 42);
    }
    ms.remove();

    if (!this.animated || this.preference.matches) return;
    const bones = Array.from(svg.querySelectorAll<SVGElement>('.bone'));
    const heads = Array.from(svg.querySelectorAll<SVGElement>('.head'));
    const letters = Array.from(svg.querySelectorAll<SVGElement>('.ltr'));
    const delay = (e: SVGElement) =>
      (Number(e.dataset['x']) - 240) * 3 + Number(e.dataset['l']) * 90;
    this.motions.push(
      utils.set(bones, { opacity: 0, scale: 0 }),
      utils.set(heads, { opacity: 0, scaleX: 0 }),
      utils.set(letters, { opacity: 0, translateY: 34 }),
    );
    const intro = createTimeline({
      defaults: { ease: 'outExpo' },
      onComplete: () => {
        this.motions.push(
          animate(mark, {
            translateY: [0, -5],
            duration: 3200,
            ease: 'inOutSine',
            alternate: true,
            loop: true,
          }),
        );
        if (!compact)
          this.motions.push(
            animate(word, {
              translateY: [0, 3],
              duration: 3200,
              ease: 'inOutSine',
              alternate: true,
              loop: true,
            }),
          );
        this.motions.push(
          animate(heads, {
            scale: [
              { to: 1.07, duration: 1200 },
              { to: 1, duration: 1200 },
            ],
            delay: stagger(150),
            ease: 'inOutSine',
            loop: true,
          }),
        );
        this.motions.push(
          animate(blur, {
            stdDeviation: [1, compact ? 1.8 : 3.5],
            duration: 2600,
            ease: 'inOutSine',
            alternate: true,
            loop: true,
          }),
        );
        const pulse = createTimeline({ loop: true, defaults: { ease: 'inOutSine' } });
        bones.forEach((e) =>
          pulse.add(
            e,
            {
              scale: [
                { to: compact ? 1.2 : 1.5, duration: 220, ease: 'outQuad' },
                { to: 1, duration: 380 },
              ],
              delay: delay(e),
            },
            0,
          ),
        );
        if (!compact)
          letters.forEach((e, i) =>
            pulse.add(
              e,
              {
                translateY: [
                  { to: -10, duration: 260, ease: 'outQuad' },
                  { to: 0, duration: 460 },
                ],
                fill: [
                  { to: e.dataset['c'] || '#fff', duration: 260 },
                  { to: '#ffffff', duration: 700 },
                ],
                delay: i * 90,
              },
              1150,
            ),
          );
        pulse.add({ duration: 10 }, 4400);
        this.motions.push(pulse);
      },
    });
    intro.add(
      heads,
      { opacity: 1, scaleX: [0, 1], duration: 1200, delay: stagger(110), ease: 'outElastic(1,.7)' },
      0,
    );
    bones.forEach((e) =>
      intro.add(
        e,
        { opacity: 1, scale: [0, 1], duration: 700, delay: delay(e), ease: 'outBack' },
        250,
      ),
    );
    if (!compact)
      letters.forEach((e, i) =>
        intro.add(
          e,
          {
            opacity: 1,
            translateY: 0,
            rotate: [i % 2 ? 5 : -5, 0],
            fill: [e.dataset['c'] || '#fff', '#ffffff'],
            duration: 1000,
            delay: i * 80,
            ease: 'outBack',
          },
          900,
        ),
      );
    this.motions.push(intro);
  }
}
