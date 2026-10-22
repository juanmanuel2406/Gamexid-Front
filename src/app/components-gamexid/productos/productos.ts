import { Component, inject, signal, computed, effect, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { Catalogo } from './catalogo';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { GamexidService, Product, BranchStock, SerializedUnit } from '../../services-gamexid/gamexid-service';
import { Workspace } from '../../core/workspace';
import { Icon } from '../../shared/icon';
import { InventoryStore } from '../../core/inventory-store';
import { enterStagger, growBars } from '../../shared/anim';
@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [FormsModule, TableModule, DialogModule, TagModule, TooltipModule, Icon, Catalogo],
  templateUrl: './productos.html',
  styleUrl: './productos.css',
})
export class Productos {
  private data = inject(GamexidService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly localInventory = signal(false);
  readonly inventory = signal(this.route.snapshot.queryParamMap.get('vista') === 'inventario');
  selectInventory(value: boolean) {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { vista: value ? 'inventario' : null }, replaceUrl: true });
  }
  readonly workspace = inject(Workspace);
  private store = inject(InventoryStore);

  readonly stock = computed(() => {
    return new Map(this.productos().map(p => [p.id, p.stock]));
  });
  readonly maxStock = computed(() => Math.max(1, ...this.stock().values()));
  private entered = false;
  readonly productos = signal<BranchStock[]>([]);
  readonly filtro = signal('');
  readonly mostrarAlta = signal(false);
  readonly saving = signal(false);
  readonly detalle = signal<Product | null>(null);
  readonly units = signal<SerializedUnit[]>([]);
  draft = { sku: '', name: '', ean: '', requiresSerialNumber: false };
  readonly filtered = computed(() => this.productos());
  /** Branch chosen inside the inventory view (mandatory for /api/inventory/stock). */
  readonly stockBranchId = signal(this.workspace.branchId());
  readonly activeBranches = computed(() => this.workspace.branches().filter((b) => b.isActive));
  readonly stockBranch = computed(() => this.activeBranches().find((b) => b.id === this.stockBranchId()));
  readonly totalUnits = computed(() => this.productos().reduce((sum, p) => sum + Math.max(0, p.stock), 0));
  /** Spotlight cards when the search narrows to a handful of items. */
  readonly spotlight = computed(() => {
    const items = this.productos();
    return this.filtro().trim() && items.length > 0 && items.length <= 3 ? items : [];
  });
  stockLevel(n: number) {
    return n <= 0 ? 'none' : n < 3 ? 'low' : 'ok';
  }
  selectBranch(id: number) {
    this.stockBranchId.set(Number(id) || 0);
  }
  private loadVersion = 0;
  private networkRequest?: Subscription;
  private stockRequest?: Subscription;
  readonly networkError = signal(false);
  readonly loading = signal(false);
  constructor() {
    // Keep the selector in sync with a valid default once branches load.
    effect(() => {
      const ws = this.workspace.branchId();
      if (!untracked(() => this.stockBranch()) && this.activeBranches().some((b) => b.id === ws)) untracked(() => this.stockBranchId.set(ws));
    });
    effect(onCleanup => {
      const branch = this.stockBranchId();
      const search = this.filtro();
      const visible = this.inventory() && this.localInventory();
      untracked(() => { this.productos.set([]); this.units.set([]); this.detalle.set(null); ++this.loadVersion; });
      if (!visible || !branch) return;
      const timer = setTimeout(() => this.load(branch, search), 200);
      onCleanup(() => { clearTimeout(timer); this.networkRequest?.unsubscribe(); this.stockRequest?.unsubscribe(); });
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const inventory = params.get('vista') === 'inventario';
      this.inventory.set(inventory);

    });
  }
  load(branch = this.stockBranchId(), search = this.filtro()) {
    if (!branch) return;
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.network.set(new Map());
    this.networkError.set(false);
    this.networkRequest?.unsubscribe();
    this.stockRequest?.unsubscribe();
    this.stockRequest = this.data.getStock(branch, search).subscribe({
      next: (p) => {
        if (version !== this.loadVersion) return;
        this.loading.set(false);
        this.productos.set(p);
        this.loadNetwork(version, search);
        if (!this.entered) {
          this.entered = true;
          setTimeout(() => {
            enterStagger(document.querySelectorAll('.prod-row'), 0, 25);
            growBars(Array.from(document.querySelectorAll('.prod-row .strip i')), 'y', 220, 4);
          });
        }
      },
      error: () => { if (version === this.loadVersion) { this.loading.set(false); this.productos.set([]); this.workspace.notify('No se pudo cargar el stock de la sucursal.', 'error'); } },
    });
  }
  readonly network = signal<Map<number, number[]>>(new Map());
  readonly expanded = signal<Record<number, boolean>>({});
  private loadNetwork(version: number, search: string) {
    const branches = this.activeBranches();
    if (!branches.length || !this.productos().length) return;
    this.networkRequest = forkJoin(branches.map(b => b.id === this.stockBranchId()
      ? of(this.productos()) : this.data.getStock(b.id, search))).subscribe({
      next: all => {
        if (version !== this.loadVersion) return;
        const map = new Map<number, number[]>();
        all.forEach((rows, i) => rows.forEach(r => {
          const arr = map.get(r.id) ?? branches.map(() => 0);
          arr[i] = r.stock;
          map.set(r.id, arr);
        }));
        this.network.set(map);
      },
      error: () => { if (version === this.loadVersion) this.networkError.set(true); },
    });
  }
  cells(productId: number) {
    const branches = this.activeBranches();
    const values = this.network().get(productId);
    if (!values) return [];
    const max = Math.max(1, ...values.filter((_, i) => branches[i]?.code !== 'DEP-CENTRAL'));
    return branches.map((b, i) => {
      const n = values[i] ?? 0;
      const depot = b.code === 'DEP-CENTRAL';
      return {
        id: b.id, name: b.name, n, depot,
        here: b.id === this.stockBranchId(),
        level: this.stockLevel(n),
        fill: n <= 0 || n < 3 ? 1 : 0.45 + 0.55 * Math.min(1, n / (depot ? Math.max(...values) : max)),
      };
    });
  }
  networkTotal(productId: number) {
    return (this.network().get(productId) ?? []).reduce((a, b) => a + Math.max(0, b), 0);
  }
  toggleRow(id: number) {
    this.expanded.update((e) => ({ ...e, [id]: !e[id] }));
  }
  abrirAlta() {
    this.draft = { sku: '', name: '', ean: '', requiresSerialNumber: false };
    this.mostrarAlta.set(true);
  }
  guardarProducto() {
    if (this.saving()) return;
    if (!this.draft.sku.trim() || !this.draft.name.trim() || !this.draft.ean.trim()) {
      this.workspace.notify('Completá SKU, nombre y EAN.', 'error');
      return;
    }
    this.saving.set(true);
    this.data.crearProducto(this.draft).subscribe({
      next: () => {
        this.saving.set(false);
        this.mostrarAlta.set(false);
        this.load();
        this.store.refresh();
        this.workspace.notify('Producto creado correctamente.');
      },
      error: (e) => {
        this.saving.set(false);
        this.workspace.notify(e.error?.mensaje || 'No se pudo crear el producto.', 'error');
      },
    });
  }
  verSeriales(p: Product) {
    this.detalle.set(p);
    this.units.set([]);
    const branch = this.stockBranchId();
    this.data.getUnidadesDeProducto(p.id, branch).subscribe({
      next: u => { if (this.detalle()?.id === p.id && this.stockBranchId() === branch) this.units.set(u); },
      error: () => this.workspace.notify('No se pudieron cargar los seriales.', 'error'),
    });
  }
}
