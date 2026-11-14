import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Subscription, timeout } from 'rxjs';
import { animate, createTimeline, stagger, svg, utils } from 'animejs';
import { Workspace } from '../../core/workspace';
import { Icon } from '../../shared/icon';
import { PcIcon } from './pc-icon';
import { ProductPhoto } from '../../components-gamexid/productos/product-photo';
import { PcBuilderStore, PcItem, PcPlatform, PcProduct, PcOffer, PcQuote } from './pc-builder-store';

interface Step { id: string; name: string; query: string; icon: string; amd?: string; intel?: string; }
interface Platform { id: PcPlatform; name: string; lines: string; }

const GRID = 6;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

@Component({ selector: 'app-pc-builder', standalone: true,
  imports: [FormsModule, DatePipe, Icon, PcIcon, ProductPhoto],
  templateUrl: './pc-builder.html', styleUrl: './pc-builder.css' })
export class PcBuilder {
  readonly workspace = inject(Workspace);
  private advanceTimer?: ReturnType<typeof setTimeout>;
  readonly checks = signal<Record<string, { status: string; title: string; detail: string }[]>>({});
  readonly missing = signal<string[]>([]);
  readonly store = inject(PcBuilderStore);
  private http = inject(HttpClient);
  private host = inject(ElementRef<HTMLElement>);
  private request?: Subscription;
  private searchRequest?: Subscription;
  private ripple = new WeakMap<Element, number>();
  private resetTimer?: ReturnType<typeof setTimeout>;
  private chooser = viewChild<ElementRef<HTMLElement>>('chooser');

  readonly platforms: Platform[] = [
    { id: 'amd', name: 'AMD', lines: 'Ryzen · Athlon' },
    { id: 'intel', name: 'Intel', lines: 'Core · Core Ultra' },
  ];
  readonly steps: Step[] = [
    { id: 'cpu', name: 'Procesador', query: 'PROCESADOR', icon: 'cpu', amd: 'PROCESADOR AMD', intel: 'PROCESADOR INTEL' },
    { id: 'mother', name: 'Motherboard', query: 'MOTHER', icon: 'board' },
    { id: 'ram', name: 'Memoria RAM', query: 'MEMORIA DDR', icon: 'ram' },
    { id: 'gpu', name: 'Placa de video', query: 'PLACA VIDEO', icon: 'gpu' },
    { id: 'storage', name: 'Almacenamiento', query: 'SSD', icon: 'drive' },
    { id: 'psu', name: 'Fuente', query: 'FUENTE', icon: 'bolt' },
    { id: 'case', name: 'Gabinete', query: 'GABINETE', icon: 'case' },
    { id: 'cooler', name: 'Refrigeración', query: 'COOLER', icon: 'fan' },
  ];
  readonly cores = Array.from({ length: GRID * GRID }, (_, i) => ({ i, x: 59 + (i % GRID) * 14, y: 59 + Math.floor(i / GRID) * 14 }));
  readonly traces = [0, 1, 2, 3, 4, 5].flatMap(k => {
    const p = 66 + k * 14, jog = k < 3 ? -8 : 8;
    return [`M${p} 40V28l${jog} -10V4`, `M${p} 160v12l${jog} 10v14`, `M40 ${p}H28l-10 ${jog}H4`, `M160 ${p}h12l10 ${jog}h14`];
  });

  readonly index = signal(0);
  readonly summary = signal(false);
  readonly leaving = signal<PcPlatform | null>(null);
  readonly products = signal<PcProduct[] | null>(null);
  readonly searching = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly searchError = signal('');
  readonly partial = signal(false);
  readonly listings = signal<PcOffer[]>([]);
  readonly listingSlot = signal('');
  readonly listingNotice = signal('');
  readonly confirmReset = signal(false);
  search = '';

  readonly step = computed(() => this.steps[this.index()]);
  readonly platformName = computed(() => this.platforms.find(p => p.id === this.store.platform())?.name ?? '');
  readonly visible = this.products;
  readonly totals = computed(() => {
    const sums = new Map<string, number>();
    for (const item of this.store.items()) {
      const currency = item.selected?.currency || item.confirmedCurrency;
      if (item.selected && currency) sums.set(currency, (sums.get(currency) ?? 0) + item.selected.amount * item.quantity);
    }
    return [...sums].map(([currency, amount]) => ({ currency, amount }));
  });

  constructor() {
    effect(() => {
      this.workspace.branchId();
      untracked(() => { this.request?.unsubscribe(); this.searchRequest?.unsubscribe(); clearTimeout(this.advanceTimer);
        this.busy.set(false); this.searching.set(false); this.products.set(null); this.checks.set({}); this.missing.set([]);
        this.summary.set(false); this.index.set(0); this.leaving.set(null); this.invalidate(); });
    });
    inject(DestroyRef).onDestroy(() => { clearTimeout(this.advanceTimer); this.request?.unsubscribe(); this.searchRequest?.unsubscribe(); clearTimeout(this.resetTimer); });
    afterNextRender(() => this.store.platform() ? this.open(0) : this.introChooser());
  }

  private introChooser() {
    const root = this.chooser()?.nativeElement; if (!root || reduced()) return;
    const cards = root.querySelectorAll('.platform');
    utils.set(root.querySelectorAll('.core'), { opacity: 0.12 });
    const tl = createTimeline({ defaults: { ease: 'outExpo' } });
    tl.add(root.querySelectorAll('.intro > *'), { opacity: [0, 1], y: [14, 0], duration: 600, delay: stagger(70) })
      .add(cards, { opacity: [0, 1], y: [24, 0], scale: [0.97, 1], duration: 700, delay: stagger(110) }, '-=420');
    cards.forEach((card, c) => {
      tl.add(svg.createDrawable(card.querySelectorAll('.trace')), { draw: ['0 0', '0 1'], duration: 900, ease: 'inOutQuart', delay: stagger(14, { from: 'random' }) }, 380 + c * 120)
        .add(card.querySelectorAll('.core'), { opacity: [0.12, 1, 0.3], duration: 700, ease: 'outQuad', delay: stagger(26, { grid: [GRID, GRID], from: 'center' }) }, 760 + c * 120)
        .add(card.querySelectorAll('.wordmark span'), { opacity: [0, 1], y: ['60%', '0%'], duration: 650, delay: stagger(45) }, 820 + c * 120);
    });
  }
  wave(event: PointerEvent) {
    if (reduced() || event.pointerType !== 'mouse') return;
    const core = (event.target as Element).closest('.core'); const card = (event.currentTarget as Element);
    if (!core) return;
    const from = +(core.getAttribute('data-i') ?? 0);
    if (this.ripple.get(card) === from) return;
    this.ripple.set(card, from);
    animate(card.querySelectorAll('.core'), { opacity: [{ to: 1, duration: 140 }, { to: 0.3, duration: 520 }], ease: 'outQuad',
      delay: stagger(32, { grid: [GRID, GRID], from }) });
  }
  choose(platform: PcPlatform) {
    if (this.leaving()) return;
    const root = this.chooser()?.nativeElement;
    const branch = this.workspace.branchId();
    const start = () => { if (branch !== this.workspace.branchId()) return; this.store.platform.set(platform); this.leaving.set(null); this.open(0); };
    if (!root || reduced()) return start();
    this.leaving.set(platform);
    const card = root.querySelector(`[data-platform="${platform}"]`)!, other = root.querySelector(`.platform:not([data-platform="${platform}"])`);
    createTimeline({ onComplete: start })
      .add(card.querySelectorAll('.core'), { opacity: 1, duration: 260, ease: 'outQuad', delay: stagger(9, { grid: [GRID, GRID], from: 'center' }) })
      .add(other ?? [], { opacity: 0, scale: 0.96, duration: 280, ease: 'outQuad' }, 0)
      .add(card, { scale: [1, 1.015, 1], duration: 360, ease: 'outBack(2)' }, 120)
      .add(root, { opacity: 0, y: -10, duration: 220, ease: 'inQuad' }, '+=60');
  }

  label(slot: string) { return this.steps.find(s => s.id === slot)?.name ?? slot; }
  icon(slot: string) { return this.steps.find(s => s.id === slot)?.icon ?? 'cpu'; }
  chosen(slot: string) { return this.store.items().find(i => i.slot === slot); }
  private queryFor(step: Step) { const p = this.store.platform(); return (p && step[p]) || step.query; }

  open(i: number) {
    clearTimeout(this.advanceTimer);
    this.searchRequest?.unsubscribe(); this.searching.set(false);
    this.summary.set(false); this.index.set(i);
    const step = this.steps[i]; this.search = this.queryFor(step); this.searchError.set('');
    this.products.set(null); this.find();
    this.revealPanel();
  }
  openSummary() { this.searchRequest?.unsubscribe(); this.searching.set(false); this.summary.set(true); this.revealPanel(); }
  next() { if (!this.canAdvance()) return; this.index() < this.steps.length - 1 && !this.summary() ? this.open(this.index() + 1) : this.openSummary(); }
  previous() { this.summary() ? this.open(this.steps.length - 1) : this.index() > 0 && this.open(this.index() - 1); }

  find() {
    if (this.search.trim().length < 3 || !this.workspace.branchId()) return;
    this.searchRequest?.unsubscribe();
    this.searching.set(true); this.searchError.set(''); this.products.set(null); this.checks.set({}); this.missing.set([]);
    const body = { branchId: this.workspace.branchId(), slot: this.step().id, items: this.store.context(), search: this.search.trim(), includePending: true };
    this.searchRequest = this.http.post<{ products: { product: PcProduct; checks: { status: string; title: string; detail: string }[] }[];
      truncated: boolean; missingSteps: string[] }>('/api/pc-builder/options', body).pipe(timeout(90000)).subscribe({
      next: result => { this.products.set(result.products.map(p => p.product));
        this.checks.set(Object.fromEntries(result.products.map(p => [p.product.id, p.checks])));
        this.missing.set(result.missingSteps); this.partial.set(result.truncated); this.searching.set(false); this.revealGrid(); },
      error: error => { this.searchError.set(error.error?.mensaje || 'No se pudo consultar el catálogo de esta sucursal. Reintentá.'); this.searching.set(false); }
    });
  }
  canAdvance() { return !!this.chosen(this.step().id) || ['gpu', 'cooler'].includes(this.step().id); }
  add(product: PcProduct) {
    if (this.busy() || !product.stock || product.stock < 1) return;
    const slot = this.step().id;
    this.store.items.update(items => [...items.filter(i => i.slot !== slot), { slot, product, quantity: 1, offers: [], notices: [] }]);
    this.invalidate(); this.prices(slot); this.pulse(slot);
    clearTimeout(this.advanceTimer);
    this.advanceTimer = setTimeout(() => this.next(), reduced() ? 0 : 320);
  }
  remove(slot: string) { if (!this.busy()) { this.store.items.update(items => items.filter(i => i.slot !== slot)); this.invalidate(); } }
  reset() {
    if (!this.confirmReset() && this.store.items().length) { this.confirmReset.set(true); this.resetTimer = setTimeout(() => this.confirmReset.set(false), 3500); return; }
    clearTimeout(this.resetTimer); this.confirmReset.set(false); this.request?.unsubscribe(); this.busy.set(false);
    this.store.clear(); this.products.set(null); this.summary.set(false); this.index.set(0); this.invalidate();
    setTimeout(() => this.introChooser());
  }

  quantity(slot: string, quantity: number) {
    if (!Number.isInteger(+quantity) || +quantity < 1 || +quantity > 4) return;
    this.update(slot, { quantity: +quantity }); this.invalidate();
  }
  currency(slot: string, currency: string) { this.update(slot, { confirmedCurrency: currency || undefined }); this.invalidate(); }
  pick(slot: string, offer: PcOffer) { this.update(slot, { selected: offer, confirmedCurrency: undefined }); this.invalidate(); }
  private update(slot: string, changes: Partial<PcItem>) { this.store.items.update(items => items.map(i => i.slot === slot ? { ...i, ...changes } : i)); }
  private invalidate() { this.store.quote.set(null); this.error.set(''); this.listings.set([]); this.listingSlot.set(''); this.listingNotice.set(''); }
  prices(slot: string) {
    const item = this.chosen(slot); if (!item || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.store.quote.set(null);
    this.request = this.http.get<{ offers: PcOffer[]; notices: string[] }>('/api/pc-builder/prices/' + item.product.id, { params: { branchId: this.workspace.branchId() } }).pipe(timeout(35000)).subscribe({
      next: result => { this.update(slot, { offers: result.offers, notices: result.notices, selected: result.offers.find(o => !!o.currency), confirmedCurrency: undefined }); this.busy.set(false); },
      error: e => this.failed(e)
    });
  }
  mercado(slot: string) {
    const item = this.chosen(slot); if (!item || this.busy()) return;
    this.listings.set([]); this.listingSlot.set(slot); this.listingNotice.set(''); this.busy.set(true); this.error.set('');
    this.request = this.http.get<{ offers: PcOffer[]; notices: string[] }>('/api/pc-builder/mercadolibre/' + item.product.id, { params: { branchId: this.workspace.branchId() } }).pipe(timeout(35000)).subscribe({
      next: result => { this.listings.set(result.offers); this.listingNotice.set(result.notices.join(' ')); this.busy.set(false); },
      error: e => this.failed(e)
    });
  }
  confirm(offer: PcOffer) {
    const slot = this.listingSlot(); const item = this.chosen(slot); if (!item || this.busy()) return;
    this.busy.set(true);
    this.request = this.http.post<PcOffer>('/api/pc-builder/confirm', { branchId: this.workspace.branchId(), productId: item.product.id, offerId: offer.id }).pipe(timeout(20000)).subscribe({
      next: confirmed => { this.update(slot, { offers: [...item.offers.filter(o => o.source !== 'MercadoLibre'), confirmed], selected: confirmed }); this.invalidate(); this.busy.set(false); },
      error: e => this.failed(e)
    });
  }
  calculate() {
    if (this.busy() || !this.store.items().length) return;
    this.busy.set(true); this.error.set(''); this.store.quote.set(null);
    const items = this.store.items().map(i => ({ slot: i.slot, productId: i.product.id, quantity: i.quantity,
      offerId: i.selected?.id, confirmedCurrency: i.confirmedCurrency }));
    this.request = this.http.post<PcQuote>('/api/pc-builder/quote', { branchId: this.workspace.branchId(), items }).pipe(timeout(90000)).subscribe({
      next: quote => { this.store.quote.set(quote); this.busy.set(false); }, error: e => this.failed(e)
    });
  }
  money(value: number) { return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
  print() { window.print(); }
  private failed(error: { error?: { mensaje?: string } }) { this.busy.set(false); this.error.set(error.error?.mensaje || 'No se pudo verificar la fuente. Reintentá.'); }

  private revealPanel() {
    if (reduced()) return;
    setTimeout(() => { const head = this.host.nativeElement.querySelector('.stage-head'); head && animate(head, { opacity: [0, 1], x: [10, 0], duration: 260, ease: 'outQuart' }); });
  }
  private revealGrid() {
    if (reduced()) return;
    setTimeout(() => animate(this.host.nativeElement.querySelectorAll('.product-card'), { opacity: [0, 1], y: [10, 0], duration: 320, ease: 'outQuart', delay: stagger(28, { start: 40 }) }));
  }
  private pulse(slot: string) {
    if (reduced()) return;
    setTimeout(() => { const row = this.host.nativeElement.querySelector(`.step[data-slot="${slot}"] .ico`); row && animate(row, { scale: [0.8, 1], duration: 420, ease: 'outBack(3)' }); });
  }
}
