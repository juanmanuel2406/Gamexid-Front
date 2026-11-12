import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Subscription, timeout } from 'rxjs';
import { Icon } from '../../shared/icon';
import { ProductPhoto } from '../../components-gamexid/productos/product-photo';
import { PcBuilderStore, PcItem, PcProduct, PcOffer, PcQuote } from './pc-builder-store';

@Component({ selector: 'app-pc-builder', standalone: true,
  imports: [FormsModule, DatePipe, Icon, ProductPhoto],
  templateUrl: './pc-builder.html', styleUrl: './pc-builder.css' })
export class PcBuilder {
  readonly store = inject(PcBuilderStore);
  private http = inject(HttpClient);
  private request?: Subscription;
  private searchRequest?: Subscription;
  readonly slots = [
    { id: 'cpu', name: 'Procesador', query: 'PROCESADOR', icon: 'cpu' },
    { id: 'mother', name: 'Motherboard', query: 'MOTHER', icon: 'cpu' },
    { id: 'ram', name: 'Memoria RAM', query: 'MEMORIA DDR', icon: 'server' },
    { id: 'storage', name: 'Almacenamiento', query: 'SSD', icon: 'database' },
    { id: 'gpu', name: 'Placa de video', query: 'PLACA VIDEO', icon: 'cpu' },
    { id: 'psu', name: 'Fuente', query: 'FUENTE', icon: 'plug' },
    { id: 'case', name: 'Gabinete', query: 'GABINETE', icon: 'server' },
    { id: 'cooler', name: 'Refrigeración', query: 'COOLER', icon: 'activity' },
  ];
  readonly slot = signal('cpu');
  readonly products = signal<PcProduct[] | null>(null);
  readonly searching = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly searchError = signal('');
  readonly partial = signal(false);
  readonly listings = signal<PcOffer[]>([]);
  readonly listingSlot = signal('');
  readonly listingNotice = signal('');
  search = 'PROCESADOR';
  constructor() { inject(DestroyRef).onDestroy(() => { this.request?.unsubscribe(); this.searchRequest?.unsubscribe(); }); }
  label(slot: string) { return this.slots.find(s => s.id === slot)?.name || slot; }
  chosen(slot: string) { return this.store.items().find(i => i.slot === slot); }
  changeSlot(id: string) {
    this.searchRequest?.unsubscribe(); this.searching.set(false); this.slot.set(id);
    this.search = this.slots.find(s => s.id === id)!.query; this.products.set(null); this.searchError.set('');
  }
  find() {
    if (this.search.trim().length < 3 || this.searching()) return;
    this.searching.set(true); this.searchError.set(''); this.products.set(null);
    this.searchRequest = this.http.get<{ data: { products: PcProduct[]; truncated: boolean } }>('/api/access/gc/products', {
      params: { branchId: '6', search: this.search.trim(), onlyInStock: 'true', hideCombos: 'true' }
    }).pipe(timeout(25000)).subscribe({
      next: result => { this.products.set(result.data.products); this.partial.set(result.data.truncated); this.searching.set(false); },
      error: error => { this.searchError.set(error.error?.mensaje || 'No se pudo consultar el catálogo. Reintentá.'); this.searching.set(false); }
    });
  }
  add(product: PcProduct) {
    if (this.busy()) return;
    const slot = this.slot();
    this.store.items.update(items => [...items.filter(i => i.slot !== slot), { slot, product, quantity: 1, offers: [], notices: [] }]);
    this.invalidate(); this.prices(slot);
  }
  remove(slot: string) { if (!this.busy()) { this.store.items.update(items => items.filter(i => i.slot !== slot)); this.invalidate(); } }
  quantity(slot: string, quantity: number) {
    if (!Number.isInteger(+quantity) || +quantity < 1 || +quantity > 4) return;
    this.update(slot, { quantity: +quantity }); this.invalidate();
  }
  currency(slot: string, currency: string) { this.update(slot, { confirmedCurrency: currency || undefined }); this.invalidate(); }
  choose(slot: string, offer: PcOffer) { this.update(slot, { selected: offer, confirmedCurrency: undefined }); this.invalidate(); }
  private update(slot: string, changes: Partial<PcItem>) { this.store.items.update(items => items.map(i => i.slot === slot ? { ...i, ...changes } : i)); }
  private invalidate() { this.store.quote.set(null); this.error.set(''); this.listings.set([]); this.listingSlot.set(''); this.listingNotice.set(''); }
  prices(slot: string) {
    const item = this.chosen(slot); if (!item || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.store.quote.set(null);
    this.request = this.http.get<{ offers: PcOffer[]; notices: string[] }>('/api/pc-builder/prices/' + item.product.id).pipe(timeout(35000)).subscribe({
      next: result => { this.update(slot, { offers: result.offers, notices: result.notices, selected: undefined, confirmedCurrency: undefined }); this.busy.set(false); },
      error: e => this.failed(e)
    });
  }
  mercado(slot: string) {
    const item = this.chosen(slot); if (!item || this.busy()) return;
    this.listings.set([]); this.listingSlot.set(slot); this.listingNotice.set(''); this.busy.set(true); this.error.set('');
    this.request = this.http.get<{ offers: PcOffer[]; notices: string[] }>('/api/pc-builder/mercadolibre/' + item.product.id).pipe(timeout(35000)).subscribe({
      next: result => { this.listings.set(result.offers); this.listingNotice.set(result.notices.join(' ')); this.busy.set(false); },
      error: e => this.failed(e)
    });
  }
  confirm(offer: PcOffer) {
    const slot = this.listingSlot(); const item = this.chosen(slot); if (!item || this.busy()) return;
    this.busy.set(true);
    this.request = this.http.post<PcOffer>('/api/pc-builder/confirm', { productId: item.product.id, offerId: offer.id }).pipe(timeout(20000)).subscribe({
      next: confirmed => { this.update(slot, { offers: [...item.offers.filter(o => o.source !== 'MercadoLibre'), confirmed], selected: confirmed }); this.invalidate(); this.busy.set(false); },
      error: e => this.failed(e)
    });
  }
  calculate() {
    if (this.busy() || !this.store.items().length) return;
    this.busy.set(true); this.error.set(''); this.store.quote.set(null);
    const items = this.store.items().map(i => ({ slot: i.slot, productId: i.product.id, quantity: i.quantity,
      offerId: i.selected?.id, confirmedCurrency: i.confirmedCurrency }));
    this.request = this.http.post<PcQuote>('/api/pc-builder/quote', { items }).pipe(timeout(90000)).subscribe({
      next: quote => { this.store.quote.set(quote); this.busy.set(false); }, error: e => this.failed(e)
    });
  }
  money(value: number) { return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
  print() { window.print(); }
  private failed(error: { error?: { mensaje?: string } }) { this.busy.set(false); this.error.set(error.error?.mensaje || 'No se pudo verificar la fuente. Reintentá.'); }
}
