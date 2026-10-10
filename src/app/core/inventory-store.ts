import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of, switchMap, finalize } from 'rxjs';
import {
  GamexidService,
  InventoryMovement,
  Product,
  SerializedUnit,
} from '../services-gamexid/gamexid-service';

/**
 * Shared inventory state read by the dashboard, sedes and movement views.
 * Movements are polled often (cheap, one request); units are refreshed when the
 * movement list changes, because the API exposes units per product only.
 */
@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private data = inject(GamexidService);
  readonly products = signal<Product[]>([]);
  readonly units = signal<SerializedUnit[]>([]);
  readonly movements = signal<InventoryMovement[]>([]);
  readonly loaded = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly updatedAt = signal<Date | null>(null);
  private timer?: ReturnType<typeof setInterval>;
  private lastTopId = 0;

  readonly productById = computed(() => new Map(this.products().map((p) => [p.id, p])));
  readonly available = computed(() => this.units().filter((u) => u.status === 'Available'));
  readonly stockByBranch = computed(() => {
    const map = new Map<number, number>();
    for (const u of this.available())
      if (u.currentBranchId) map.set(u.currentBranchId, (map.get(u.currentBranchId) || 0) + 1);
    return map;
  });

  /** Full reload: products, movements and every product's units. */
  refresh() {
    if (this.loading()) return;
    this.loading.set(true);
    this.data
      .getProductos()
      .pipe(
        switchMap((products) => {
          this.products.set(products);
          return forkJoin({
            movements: this.data.getMovimientos(),
            units: products.length
              ? forkJoin(products.map((p) => this.data.getUnidadesDeProducto(p.id)))
              : of([] as SerializedUnit[][]),
          });
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ movements, units }) => {
          this.movements.set(movements);
          this.units.set(units.flat());
          this.lastTopId = movements[0]?.id ?? 0;
          this.loaded.set(true);
          this.error.set('');
          this.updatedAt.set(new Date());
        },
        error: (e) => this.error.set(e?.error?.mensaje || 'No se pudo cargar el inventario desde la API.'),
      });
  }

  /** Light poll: fetch movements; if a new one appeared, reload units too. */
  poll() {
    if (this.loading()) return;
    this.data.getMovimientos().subscribe({
      next: (movements) => {
        const top = movements[0]?.id ?? 0;
        this.movements.set(movements);
        this.updatedAt.set(new Date());
        this.error.set('');
        if (top !== this.lastTopId) {
          this.lastTopId = top;
          this.refresh();
        }
      },
      error: (e) => this.error.set(e?.error?.mensaje || 'Sin respuesta de la API de inventario.'),
    });
  }

  start(intervalMs = 15000) {
    if (!this.loaded()) this.refresh();
    this.stop();
    this.timer = setInterval(() => {
      if (!document.hidden) this.poll();
    }, intervalMs);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  reset() {
    this.stop();
    this.products.set([]);
    this.units.set([]);
    this.movements.set([]);
    this.loaded.set(false);
    this.lastTopId = 0;
  }
}
