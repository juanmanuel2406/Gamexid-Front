import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InventoryMovement } from '../../services-gamexid/gamexid-service';
import { Workspace } from '../../core/workspace';
import { InventoryStore } from '../../core/inventory-store';
import { Icon } from '../../shared/icon';
import { CountUp, enterStagger, flash, flipList, growBars, reducedMotion, unfold } from '../../shared/anim';
import { animate } from 'animejs';

export const MOVEMENT_META: Record<string, { icon: string; tone: string }> = {
  Ingreso: { icon: 'in', tone: 'ok' },
  Transferencia: { icon: 'swap', tone: 'vio' },
  Venta: { icon: 'sale', tone: 'warn' },
  Devolución: { icon: 'out', tone: 'bad' },
  Ajuste: { icon: 'adjust', tone: '' },
};
/** Sedes below this many available units are flagged for restock. */
export const LOW_STOCK = 5;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, Icon, CountUp],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  readonly workspace = inject(Workspace);
  readonly store = inject(InventoryStore);
  private host = inject(ElementRef<HTMLElement>);
  readonly meta = MOVEMENT_META;
  readonly lowStock = LOW_STOCK;
  private animated = false;
  private seenTop = 0;
  private injector = inject(Injector);

  readonly branchName = computed(() => this.workspace.branch()?.name || 'Sucursal');
  readonly local = computed(() =>
    this.store.movements().filter(
      (m) => m.destinationBranchId === this.workspace.branchId() || m.sourceBranchId === this.workspace.branchId(),
    ),
  );
  readonly available = computed(() => this.store.stockByBranch().get(this.workspace.branchId()) || 0);
  readonly networkStock = computed(() => this.store.available().length);
  readonly weekly = computed(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - 6 + i);
      return d;
    });
    const receipts = this.local().filter((m) => m.type === 'Ingreso' && m.destinationBranchId === this.workspace.branchId());
    return days.map((d) => ({
      label: d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''),
      count: receipts
        .filter((m) => new Date(m.createdAtUtc).toDateString() === d.toDateString())
        .reduce((n, m) => n + this.quantity(m), 0),
    }));
  });
  readonly maximum = computed(() => Math.max(4, ...this.weekly().map((d) => d.count)));
  readonly today = computed(() => this.weekly()[6].count);
  readonly delta = computed(() => this.weekly()[6].count - this.weekly()[5].count);
  readonly spark = computed(() =>
    this.weekly()
      .map((d, i) => `${(i / 6) * 240},${54 - (d.count / this.maximum()) * 46}`)
      .join(' '),
  );
  readonly feed = computed(() => this.store.movements().slice(0, 7));
  readonly depotStock = computed(() => {
    const depot = this.workspace.depot();
    return depot ? this.store.stockByBranch().get(depot.id) || 0 : 0;
  });
  readonly sedes = computed(() => {
    const depotId = this.workspace.depot()?.id;
    const stock = this.store.stockByBranch();
    const rows = this.workspace
      .branches()
      .filter((b) => b.id !== depotId && b.isActive)
      .map((b) => ({ branch: b, count: stock.get(b.id) || 0 }))
      .sort((a, b) => b.count - a.count || a.branch.name.localeCompare(b.branch.name));
    const max = Math.max(1, ...rows.map((r) => r.count));
    return rows.map((r) => ({ ...r, pct: (r.count / max) * 100 }));
  });

  constructor() {
    // First data → entrance; later data → animate only what changed.
    effect(() => {
      const loaded = this.store.loaded();
      const top = this.store.movements()[0]?.id ?? 0;
      this.sedes();
      untracked(() => {
        if (!loaded) return;
        if (!this.animated) {
          this.animated = true;
          this.seenTop = top;
          queueMicrotask(() => this.entrance());
          return;
        }
        // Component effects run before the template refreshes: capture rows now, slide after render.
        const slide = flipList(this.q('.stock-list')[0], 'data-row');
        const fresh = !!top && top !== this.seenTop;
        this.seenTop = top;
        afterNextRender(() => { slide(); if (fresh) this.newActivity(); }, { injector: this.injector });
      });
    });
  }
  private q(sel: string) {
    return Array.from((this.host.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(sel));
  }
  private entrance() {
    enterStagger(this.q('.metric'), 0, 50);
    enterStagger(this.q('[data-enter]'), 150, 70);
    growBars(this.q('.bar'), 'y', 250, 50);
    growBars(this.q('.s-row .gx-meter i'), 'x', 300, 25);
    const line = this.q('.spark-line')[0] as unknown as SVGPolylineElement | undefined;
    if (line && !reducedMotion()) {
      const len = line.getTotalLength();
      line.style.strokeDasharray = String(len);
      animate(line, { strokeDashoffset: [len, 0], duration: 1000, delay: 250, ease: 'inOutQuart' });
    }
  }
  private newActivity() {
    const item = this.q('.feed-item')[0];
    unfold(item);
    flash(item, 'rgba(255,0,230,.12)');
  }
  quantity(m: InventoryMovement) {
    return m.items.reduce((n, i) => n + i.quantity, 0);
  }
  productName(m: InventoryMovement) {
    const first = this.store.productById().get(m.items[0]?.productId);
    const extra = m.items.length > 1 ? ` +${m.items.length - 1}` : '';
    return (first?.name || 'Producto #' + (m.items[0]?.productId ?? '?')) + extra;
  }
  route(m: InventoryMovement) {
    const name = (id?: number) => this.workspace.branches().find((b) => b.id === id)?.name;
    return [name(m.sourceBranchId), name(m.destinationBranchId)].filter(Boolean).join(' → ') || '—';
  }
  serviceTag(state: string) {
    return state === 'ok' ? 'ok' : state === 'pending' ? '' : state === 'checking' ? '' : 'bad';
  }
}
