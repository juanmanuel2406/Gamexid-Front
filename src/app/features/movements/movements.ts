import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryMovement } from '../../services-gamexid/gamexid-service';
import { Workspace } from '../../core/workspace';
import { InventoryStore } from '../../core/inventory-store';
import { Icon } from '../../shared/icon';
import { enterStagger, flash, unfold } from '../../shared/anim';
import { MOVEMENT_META } from '../../components-gamexid/dashboard/dashboard';

type Scope = 'sede' | 'red';

/** Auditoría de movimientos: línea de tiempo de /api/inventory/movements con filtros. */
@Component({
  selector: 'gx-movements',
  standalone: true,
  imports: [DatePipe, FormsModule, Icon],
  templateUrl: './movements.html',
  styleUrl: './movements.css',
})
export class Movements {
  readonly workspace = inject(Workspace);
  readonly store = inject(InventoryStore);
  private host = inject(ElementRef<HTMLElement>);
  private injector = inject(Injector);
  readonly meta = MOVEMENT_META;
  readonly types = ['Todos', 'Ingreso', 'Transferencia', 'Venta', 'Devolución', 'Ajuste'];
  readonly type = signal('Todos');
  readonly scope = signal<Scope>('red');
  readonly query = signal('');
  readonly limit = signal(40);
  readonly expanded = signal<number | null>(null);
  private seenTop = 0;

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const branch = this.workspace.branchId();
    return this.store.movements().filter(
      (m) =>
        (this.type() === 'Todos' || m.type === this.type()) &&
        (this.scope() === 'red' || m.destinationBranchId === branch || m.sourceBranchId === branch) &&
        (!q ||
          [String(m.id), m.notes || '', this.products(m), this.route(m)].some((v) => v.toLowerCase().includes(q))),
    );
  });
  readonly visible = computed(() => this.filtered().slice(0, this.limit()));
  readonly counts = computed(() => {
    const map = new Map<string, number>();
    for (const m of this.store.movements()) map.set(m.type, (map.get(m.type) || 0) + 1);
    return map;
  });

  constructor() {
    effect(() => {
      const loaded = this.store.loaded();
      const top = this.store.movements()[0]?.id ?? 0;
      untracked(() => {
        if (!loaded) return;
        const first = this.seenTop === 0;
        const fresh = !first && top !== this.seenTop;
        this.seenTop = top || -1;
        afterNextRender(
          () => {
            if (first) enterStagger(this.q('.tl-item'), 0, 25);
            else if (fresh) {
              const item = this.q('.tl-item')[0];
              unfold(item);
              flash(item, 'rgba(255,0,230,.12)');
            }
          },
          { injector: this.injector },
        );
      });
    });
  }
  private q(sel: string) {
    return Array.from((this.host.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(sel));
  }
  setType(t: string) {
    this.type.set(t);
    this.limit.set(40);
    afterNextRender(() => enterStagger(this.q('.tl-item'), 0, 20), { injector: this.injector });
  }
  quantity(m: InventoryMovement) {
    return m.items.reduce((n, i) => n + i.quantity, 0);
  }
  products(m: InventoryMovement) {
    const names = this.store.productById();
    const unique = [...new Set(m.items.map((i) => i.productId))];
    return unique.map((id) => names.get(id)?.name || 'Producto #' + id).join(', ');
  }
  route(m: InventoryMovement) {
    const name = (id?: number) => this.workspace.branches().find((b) => b.id === id)?.name;
    return [name(m.sourceBranchId), name(m.destinationBranchId)].filter(Boolean).join(' → ') || '—';
  }
  serials(m: InventoryMovement) {
    const units = new Map(this.store.units().map((u) => [u.id, u.serialNumber]));
    return m.items.filter((i) => i.serializedUnitId).map((i) => units.get(i.serializedUnitId!) || '#' + i.serializedUnitId);
  }
  toggle(id: number) {
    this.expanded.set(this.expanded() === id ? null : id);
  }
}
