import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { FastScanService, Product } from '../../services-fastscan/fastscan-service';
import { OrdersService, BranchOrder, OrderLine } from '../../services-fastscan/orders';
import { Workspace } from '../../core/workspace';
import { Icon } from '../../shared/icon';
import { Intake, Extraction } from '../../features/intake/intake';
@Component({
  selector: 'app-sucursales',
  standalone: true,
  imports: [FormsModule, DialogModule, TagModule, SkeletonModule, Icon, Intake],
  templateUrl: './sucursales.html',
  styleUrl: './sucursales.css',
})
export class Sucursales implements OnInit {
  private data = inject(FastScanService);
  private orders = inject(OrdersService);
  readonly workspace = inject(Workspace);
  readonly products = signal<Product[]>([]);
  readonly pedidos = signal<BranchOrder[]>([]);
  readonly draft = signal<BranchOrder | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly branches = computed(() =>
    this.workspace.branches().filter((b) => b.id !== this.data.getDeposito().id),
  );
  readonly filtered = computed(() =>
    this.pedidos().filter((p) => p.branchId === this.workspace.branchId()),
  );
  async ngOnInit() {
    this.data.getProductos().subscribe((p) => this.products.set(p));
    try {
      this.pedidos.set(await this.orders.list());
    } catch {
      this.workspace.notify('No se pudieron cargar los pedidos.', 'error');
    } finally {
      this.loading.set(false);
    }
  }
  nuevo() {
    this.error.set('');
    this.draft.set({
      id: crypto.randomUUID(),
      reference: '',
      branchId: this.branches().some((b) => b.id === this.workspace.branchId())
        ? this.workspace.branchId()
        : 0,
      created: new Date().toISOString(),
      fileName: '',
      lines: [],
    });
  }
  editar(order: BranchOrder) {
    this.error.set('');
    this.draft.set(structuredClone(order));
  }
  agregar() {
    this.draft.update((d) =>
      d ? { ...d, lines: [...d.lines, { ean: '', name: '', expected: null, received: 0 }] } : null,
    );
  }
  parsed(result: Extraction) {
    this.draft.update((d) => {
      if (!d) return null;
      const lines = d.lines.map((line) => {
        const extracted = result.lines.find((candidate) => candidate.ean === line.ean);
        return extracted
          ? {
              ...line,
              name: line.name || extracted.name || '',
              expected: line.expected ?? extracted.expected,
            }
          : line;
      });
      const existing = new Set(lines.map((line) => line.ean));
      for (const line of result.lines) {
        if (!existing.has(line.ean)) {
          lines.push({
            ean: line.ean,
            name: line.name || this.products().find((p) => p.ean === line.ean)?.name || '',
            expected: line.expected,
            received: 0,
          });
          existing.add(line.ean);
        }
      }
      return { ...d, pdf: result.file, fileName: result.file.name, lines };
    });
  }
  relacionar(line: OrderLine) {
    const p = this.products().find((p) => p.ean === line.ean.trim());
    if (p) line.name = p.name;
  }
  marcar(line: OrderLine, event: Event) {
    line.received = (event.target as HTMLInputElement).checked ? line.expected || 0 : 0;
  }
  faltantes(p: BranchOrder) {
    return p.lines.reduce((n, l) => n + Math.max(0, (l.expected || 0) - l.received), 0);
  }
  nombre(id: number) {
    return this.workspace.branches().find((b) => b.id === id)?.name || 'Sucursal archivada';
  }
  async guardar() {
    const d = this.draft();
    if (!d || this.busy()) return;
    this.busy.set(true);
    try {
      if (!this.branches().some((b) => b.id === d.branchId))
        throw new Error('Seleccioná una sucursal activa.');
      await this.orders.save(d);
      this.pedidos.set(await this.orders.list());
      this.workspace.select(d.branchId);
      this.draft.set(null);
      this.workspace.notify('Pedido guardado. Podés volver a abrirlo para controlar la recepción.');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar el pedido.');
    } finally {
      this.busy.set(false);
    }
  }
  descargar() {
    const d = this.draft();
    if (!d?.pdf) return;
    const url = URL.createObjectURL(d.pdf);
    const link = document.createElement('a');
    link.href = url;
    link.download = d.fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
