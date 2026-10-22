import { Component, inject, signal, computed, input, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { finalize, timeout, Subscription } from 'rxjs';

interface CatalogProduct {
  id: string; name: string; code: string; supplierCode: string;
  sku: string; price: number | null; stock: number | null;
}
interface PortalBranch { id: number; name: string; depotId: number; }
interface Catalog { products: CatalogProduct[]; total: number; truncated: boolean; }

@Component({
  selector: 'gx-catalogo',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <section class="space-y-6 max-w-5xl">
      <div role="status" class="text-sm text-slate-400">{{ checking() ? 'Conectando…' : connected() ? 'Conectado' : configured() ? 'Catálogo disponible' : 'Catálogo no configurado' }}</div>
      <label class="block">Sede
        <select aria-label="Sede de Gaming City" class="block w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3"
          [ngModel]="branchId()" (ngModelChange)="selectBranch($event)">
          <option [ngValue]="0" disabled>Seleccioná una sede</option>
          @for (branch of branches(); track branch.id) { <option [ngValue]="branch.id">{{ branch.name }}</option> }
        </select>
      </label>
      <div class="flex flex-wrap gap-5">
        <label><input type="checkbox" [(ngModel)]="onlyInStock" (ngModelChange)="clear()" /> Solo con stock</label>
        <label><input type="checkbox" [(ngModel)]="hideCombos" (ngModelChange)="clear()" /> Ocultar combos</label>
      </div>
      <form (ngSubmit)="query()" class="flex flex-wrap items-end gap-3">
        <label class="flex-1 min-w-48">Buscar producto o código
          <input class="block w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3" name="search" [(ngModel)]="search" minlength="3" maxlength="80" placeholder="Nombre o código del producto" />
        </label>
        <button class="rounded-lg bg-violet-600 px-5 py-3 disabled:opacity-40" [disabled]="!configured() || !branchId() || busy() || search.trim().length < 3">Consultar catálogo</button>
      </form>
      @if (!inventory()) {
      <form (ngSubmit)="queryById()" class="flex flex-wrap items-end gap-3">
        <label class="flex-1 min-w-48">ID de producto
          <input class="block w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3" name="productId" [(ngModel)]="productId" inputmode="numeric" pattern="[0-9]{1,20}" maxlength="20" placeholder="Ejemplo: 4715" />
        </label>
        <button class="rounded-lg border border-slate-700 px-5 py-3 disabled:opacity-40" [disabled]="!configured() || !branchId() || busy() || !validId()">Consultar por ID</button>
      </form>
      }
      @if (error()) { <p role="alert" class="text-red-400">{{ error() }}</p> }
      @if (busy()) { <p role="status" class="text-slate-400">Consultando Gaming City…</p> }
      @if (result(); as catalog) {
        <section aria-label="Resultados del catálogo">
          <h2 class="text-lg mb-3">{{ catalog.total }} productos encontrados</h2>
          <p class="text-slate-400 mb-3">{{ selectedBranch()?.name }} · {{ totalStock() | number }} unidades{{ catalog.truncated ? ' en los resultados mostrados' : '' }}</p>
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
                  <div><dt class="text-slate-400">Stock en {{ selectedBranch()?.name }}</dt><dd>{{ product.stock === null ? 'No informado' : (product.stock | number:'1.0-2') }}</dd></div>
                </dl>
              </article>
            }
          </div>
        </section>
      }
    </section>`,
})
export class Catalogo implements OnDestroy {
  readonly inventory = input(false);
  readonly branches = signal<PortalBranch[]>([]);
  readonly branchId = signal(0);
  readonly selectedBranch = computed(() => this.branches().find(b => b.id === this.branchId()));
  readonly totalStock = computed(() => (this.result()?.products ?? []).reduce((total, p) => total + Math.max(0, p.stock ?? 0), 0));
  onlyInStock = true;
  hideCombos = true;
  private request?: Subscription;
  private branchRequest?: Subscription;
  selectBranch(id: number) { this.clear(); this.branchId.set(Number(id)); }
  clear() { this.request?.unsubscribe(); this.result.set(null); this.error.set(''); this.connected.set(false); }
  ngOnDestroy() { this.request?.unsubscribe(); this.branchRequest?.unsubscribe(); }

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
    this.branchRequest = this.http.get<PortalBranch[]>('/api/access/gc/branches').subscribe({
      next: branches => this.branches.set(branches),
      error: () => this.error.set('No se pudieron cargar las sedes de Gaming City.'),
    });
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
    if (!this.configured() || !this.branchId() || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.result.set(null); this.connected.set(false);
    this.detail.set(byId);
    const url = '/api/access/gc/products' + (byId ? '/' + encodeURIComponent(this.productId.trim()) : '');
    const params: Record<string, string> = { branchId: String(this.branchId()) };
    if (!byId) Object.assign(params, { search: this.search.trim(), onlyInStock: String(this.onlyInStock), hideCombos: String(this.hideCombos) });
    this.request = this.http.get<{ data: Catalog | CatalogProduct }>(url, { params })
      .pipe(timeout(25000), finalize(() => this.busy.set(false))).subscribe({
        next: (r) => {
          this.result.set(byId ? { products: [r.data as CatalogProduct], total: 1, truncated: false } : r.data as Catalog);
          this.connected.set(true);
        },
        error: (e) => this.error.set(e.error?.mensaje || 'No se pudo completar la consulta. Reintentá.'),
      });
  }
}
