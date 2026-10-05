import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import {
  GamexidService,
  Product,
  SerializedUnit,
  InventoryMovement,
} from '../../services-gamexid/gamexid-service';
import { Workspace } from '../../core/workspace';
import { Icon } from '../../shared/icon';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, Icon, SkeletonModule, TagModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private data = inject(GamexidService);
  readonly workspace = inject(Workspace);
  readonly loading = signal(true);
  readonly products = signal<Product[]>([]);
  readonly units = signal<SerializedUnit[]>([]);
  readonly movements = signal<InventoryMovement[]>([]);
  readonly localMovements = computed(() =>
    this.movements().filter((m) => m.destinationBranchId === this.workspace.branchId()),
  );
  readonly localUnits = computed(() =>
    this.units().filter((u) => u.currentBranchId === this.workspace.branchId()),
  );
  readonly weekly = computed(() =>
    Array.from({ length: 7 }, (_, i) => {
      const day = new Date();
      day.setDate(day.getDate() - 6 + i);
      return {
        label: day.toLocaleDateString('es-AR', { weekday: 'short' }),
        count: this.localMovements()
          .filter((m) => new Date(m.createdAtUtc).toDateString() === day.toDateString())
          .reduce((n, m) => n + this.quantity(m), 0),
      };
    }),
  );
  readonly maximum = computed(() => Math.max(1, ...this.weekly().map((d) => d.count)));
  readonly today = computed(() => this.weekly().at(-1)?.count || 0);
  readonly delta = computed(() => {
    const days = this.weekly();
    const before = days[5].count;
    return before
      ? (((days[6].count - before) / before) * 100).toFixed(0) + '%'
      : 'Sin base comparativa';
  });
  readonly spark = computed(() =>
    this.weekly()
      .map((d, i) => i * 40 + ',' + (50 - (d.count / this.maximum()) * 40))
      .join(' '),
  );
  readonly available = computed(
    () => this.localUnits().filter((u) => u.status === 'Available').length,
  );
  ngOnInit() {
    this.data
      .getProductos()
      .pipe(
        switchMap((products) => {
          this.products.set(products);
          return forkJoin({
            movements: this.data.getMovimientos(),
            units: products.length
              ? forkJoin(products.map((p) => this.data.getUnidadesDeProducto(p.id)))
              : of([]),
          });
        }),
      )
      .subscribe({
        next: (r) => {
          this.movements.set(r.movements);
          this.units.set(r.units.flat());
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.workspace.notify('No se pudieron cargar los indicadores.', 'error');
        },
      });
  }
  quantity(m: InventoryMovement) {
    return m.items.reduce((n, i) => n + i.quantity, 0);
  }
  branchName() {
    return (
      this.workspace.branches().find((b) => b.id === this.workspace.branchId())?.name || 'Sucursal'
    );
  }
}
