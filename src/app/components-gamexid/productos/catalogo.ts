import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { finalize, timeout } from 'rxjs';

interface CatalogProduct {
  id: string; name: string; code: string; supplierCode: string;
  sku: string; price: number | null; stock: number | null;
}
interface Catalog { products: CatalogProduct[]; total: number; truncated: boolean; }

@Component({
  selector: 'gx-catalogo',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <section class="space-y-6 max-w-5xl">
      <div role="status" class="text-sm text-slate-400">{{ checking() ? 'Conectando…' : connected() ? 'Conectado' : configured() ? 'Catálogo disponible' : 'Catálogo no configurado' }}</div>
      <form (ngSubmit)="query()" class="flex flex-wrap items-end gap-3">
        <label class="flex-1 min-w-48">Buscar producto o código
          <input class="block w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3" name="search" [(ngModel)]="search" minlength="3" maxlength="80" placeholder="Nombre o código del producto" />
        </label>
        <button class="rounded-lg bg-violet-600 px-5 py-3 disabled:opacity-40" [disabled]="!configured() || busy() || search.trim().length < 3">Consultar catálogo</button>
      </form>
      <form (ngSubmit)="queryById()" class="flex flex-wrap items-end gap-3">
        <label class="flex-1 min-w-48">ID de producto
          <input class="block w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3" name="productId" [(ngModel)]="productId" inputmode="numeric" pattern="[0-9]{1,20}" maxlength="20" placeholder="Ejemplo: 4715" />
        </label>
        <button class="rounded-lg border border-slate-700 px-5 py-3 disabled:opacity-40" [disabled]="!configured() || busy() || !validId()">Consultar por ID</button>
      </form>
      @if (error()) { <p role="alert" class="text-red-400">{{ error() }}</p> }
      @if (busy()) { <p role="status" class="text-slate-400">Consultando Gaming City…</p> }
      @if (result(); as catalog) {
        <section aria-label="Resultados del catálogo">
          <h2 class="text-lg mb-3">{{ catalog.total }} productos encontrados</h2>
          @if (detail()) { <p class="text-slate-400 mb-3">Stock proveedor · depósito 1</p> }
          @if (catalog.truncated) { <p class="text-amber-400 mb-3">Primeros 100 resultados</p> }
          @if (!catalog.products.length) { <p>Sin resultados</p> }
          <div class="space-y-3">
            @for (product of catalog.products; track product.id) {
              <article class="bg-slate-900 p-4 border border-slate-800 rounded-lg break-words">
                <h3 class="font-medium">{{ product.name }}</h3>
                <dl class="grid sm:grid-cols-2 gap-2 text-sm mt-3">
                  <div><dt class="text-slate-400">ID</dt><dd>{{ product.id }}</dd></div>
                  <div><dt class="text-slate-400">Código</dt><dd>{{ product.code || 'No informado' }}</dd></div>
                  <div><dt class="text-slate-400">Código de proveedor</dt><dd>{{ product.supplierCode || 'No informado' }}</dd></div>
                  <div><dt class="text-slate-400">SKU</dt><dd>{{ product.sku || 'No informado' }}</dd></div>
                  <div><dt class="text-slate-400">Precio informado</dt><dd>{{ product.price === null ? 'No informado' : (product.price | number:'1.2-2') }}</dd></div>
                  <div><dt class="text-slate-400">Stock proveedor</dt><dd>{{ product.stock === null ? 'No informado' : (product.stock | number:'1.0-2') }}</dd></div>
                </dl>
              </article>
            }
          </div>
        </section>
      }
    </section>`,
})
export class Catalogo {
  private http = inject(HttpClient);
  readonly configured = signal(false);
  readonly checking = signal(true);
  readonly connected = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly result = signal<Catalog | null>(null);
  readonly detail = signal(false);
  search = '';
  productId = '';
  constructor() {
    this.http.get<{ configured: boolean }>('/api/access/gc/status').pipe(timeout(5000), finalize(() => this.checking.set(false))).subscribe({
      next: (s) => this.configured.set(s.configured === true),
      error: () => this.error.set('No se pudo consultar el estado del conector.'),
    });
  }
  validId() { return /^[0-9]{1,20}$/.test(this.productId.trim()); }
  query() {
    if (this.search.trim().length < 3 || this.search.trim().length > 80) return;
    this.fetch(false);
  }
  queryById() {
    if (!this.validId()) return;
    this.fetch(true);
  }
  private fetch(byId: boolean) {
    if (!this.configured() || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.result.set(null); this.connected.set(false);
    this.detail.set(byId);
    const url = '/api/access/gc/products' + (byId ? '/' + encodeURIComponent(this.productId.trim()) : '');
    const params: Record<string, string> = byId ? {} : { search: this.search.trim() };
    this.http.get<{ data: Catalog | CatalogProduct }>(url, { params })
      .pipe(timeout(25000), finalize(() => this.busy.set(false))).subscribe({
        next: (r) => {
          this.result.set(byId ? { products: [r.data as CatalogProduct], total: 1, truncated: false } : r.data as Catalog);
          this.connected.set(true);
        },
        error: (e) => this.error.set(e.error?.mensaje || 'No se pudo completar la consulta. Reintentá.'),
      });
  }
}
