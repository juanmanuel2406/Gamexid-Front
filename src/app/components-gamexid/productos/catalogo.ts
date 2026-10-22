import { Component, inject, signal, computed, input, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { finalize, timeout, Subscription } from 'rxjs';

interface CatalogProduct {
  id: string;
  name: string;
  code: string;
  supplierCode: string;
  sku: string;
  price: number | null;
  stock: number | null;
}
interface PortalBranch {
  id: number;
  name: string;
  depotId: number;
}
interface Catalog {
  products: CatalogProduct[];
  total: number;
  truncated: boolean;
}

@Component({
  selector: 'gx-catalogo',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './catalogo.html',
})
export class Catalogo implements OnDestroy {
  readonly inventory = input(false);
  readonly branches = signal<PortalBranch[]>([]);
  readonly branchId = signal(0);
  readonly selectedBranch = computed(() => this.branches().find((b) => b.id === this.branchId()));
  readonly totalStock = computed(() =>
    (this.result()?.products ?? []).reduce((total, p) => total + Math.max(0, p.stock ?? 0), 0),
  );
  onlyInStock = true;
  hideCombos = true;
  private request?: Subscription;
  private branchRequest?: Subscription;
  seleccionarSede(id: number) {
    this.limpiarResultados();
    this.branchId.set(Number(id));
  }
  limpiarResultados() {
    this.request?.unsubscribe();
    this.result.set(null);
    this.error.set('');
    this.connected.set(false);
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
    this.branchRequest?.unsubscribe();
  }

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
      next: (branches) => this.branches.set(branches),
      error: () => this.error.set('No se pudieron cargar las sedes de Gaming City.'),
    });
    this.http
      .get<{ configured: boolean }>('/api/access/gc/status')
      .pipe(
        timeout(5000),
        finalize(() => this.checking.set(false)),
      )
      .subscribe({
        next: (s) => this.configured.set(s.configured === true),
        error: () => this.error.set('No se pudo consultar el estado del conector.'),
      });
  }
  idValido() {
    return /^[0-9]{1,20}$/.test(this.productId.trim());
  }
  buscar() {
    if (this.search.trim().length < 3 || this.search.trim().length > 80) return;
    this.consultarCatalogo(false);
  }
  buscarPorId() {
    if (!this.idValido()) return;
    this.consultarCatalogo(true);
  }
  private consultarCatalogo(byId: boolean) {
    if (!this.configured() || !this.branchId() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.result.set(null);
    this.connected.set(false);
    this.detail.set(byId);
    const url =
      '/api/access/gc/products' + (byId ? '/' + encodeURIComponent(this.productId.trim()) : '');
    const params: Record<string, string> = { branchId: String(this.branchId()) };
    if (!byId) {
      params['search'] = this.search.trim();
      params['onlyInStock'] = String(this.onlyInStock);
      params['hideCombos'] = String(this.hideCombos);
    }
    this.request = this.http
      .get<{ data: Catalog | CatalogProduct }>(url, { params })
      .pipe(
        timeout(25000),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (r) => {
          if (byId) {
            this.result.set({ products: [r.data as CatalogProduct], total: 1, truncated: false });
          } else {
            this.result.set(r.data as Catalog);
          }
          this.connected.set(true);
        },
        error: (e) =>
          this.error.set(e.error?.mensaje || 'No se pudo completar la consulta. Reintentá.'),
      });
  }
}
