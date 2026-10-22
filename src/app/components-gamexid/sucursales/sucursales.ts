import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { GamexidService, Product } from '../../services-gamexid/gamexid-service';
import { OrdersService, BranchOrder, OrderLine } from '../../services-gamexid/orders';
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
  private data = inject(GamexidService);
  private orders = inject(OrdersService);
  readonly workspace = inject(Workspace);
  readonly products = signal<Product[]>([]);
  readonly pedidos = signal<BranchOrder[]>([]);
  readonly draft = signal<BranchOrder | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly listError = signal('');
  readonly page = signal(1);
  readonly total = signal(0);
  search = '';
  statusFilter = '';
  scanCode = '';
  serialCode = '';
  readonly selectedLine = signal<number | null>(null);
  private loadVersion = 0;
  constructor() {
    effect(() => { const branch = this.workspace.branchId(); void this.load(1, branch); });
  }
  async load(page = 1, branch = this.workspace.branchId()) {
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.listError.set('');
    try {
      const result = await this.orders.list(branch, page, this.search, this.statusFilter);
      if (version !== this.loadVersion) return;
      this.pedidos.set(result.items);
      this.page.set(result.page);
      this.total.set(result.total);
    } catch (e) {
      if (version === this.loadVersion) this.listError.set(this.orders.message(e));
    } finally { if (version === this.loadVersion) this.loading.set(false); }
  }
  readonly branches = computed(() =>
    this.workspace
      .branches()
      .filter(
        (b) =>
          b.id !== this.data.getDeposito().id &&
          (b.isActive ||
            this.pedidos().some((p) => p.id === this.draft()?.id && p.branchId === b.id)),
      ),
  );
  readonly filtered = computed(() =>
    this.pedidos().filter((p) => p.branchId === this.workspace.branchId()),
  );
  async ngOnInit() {
    this.data.getProductos().subscribe({ next: p => this.products.set(p),
      error: () => this.workspace.notify('No se pudo cargar el catálogo.', 'error') });
  }
  nuevo() {
    this.error.set('');
    this.selectedLine.set(null);
    this.scanCode = '';
    this.serialCode = '';
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
    this.selectedLine.set(null);
    this.scanCode = '';
    this.serialCode = '';
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
        const extracted = result.lines.find((candidate) =>
          (candidate.ean && candidate.ean === line.ean) || (candidate.sku && candidate.sku === line.sku));
        return extracted
          ? {
              ...line,
              name: line.name || extracted.name || '',
              expected: line.expected ?? extracted.expected,
              sku: line.sku || extracted.sku,
              unitPrice: line.unitPrice ?? extracted.unitPrice,
              total: line.total ?? extracted.total,
              currency: line.currency || extracted.currency,
            }
          : line;
      });
      const existing = new Set(lines.map((line) => line.ean || line.sku));
      for (const line of result.lines) {
        const product = this.products().find(p => (line.ean && p.ean === line.ean) || (line.sku && p.sku.toUpperCase() === line.sku.toUpperCase()));
        const ean = line.ean || product?.ean || '';
        const key = ean || line.sku;
        if (!existing.has(key)) {
          lines.push({
            ean,
            sku: line.sku,
            unitPrice: line.unitPrice,
            total: line.total,
            currency: line.currency,
            name: line.name || this.products().find((p) => p.ean === line.ean)?.name || '',
            expected: line.expected,
            received: 0,
          });
          existing.add(key);
        }
      }
      const detected = result.source === 'pdfpig' ? result.reference?.trim() || '' : '';
      const sameFile = d.pdf === result.file;
      const manual = d.referenceSource === 'manual' || (!d.referenceSource && !!d.reference.trim());
      const reference = detected || (manual || (sameFile && result.source !== 'pdfpig') ? d.reference : '');
      const referenceSource: BranchOrder['referenceSource'] = detected ? 'pdf' : reference.trim() ? (manual ? 'manual' : d.referenceSource) : 'missing';
      return { ...d, reference, referenceSource, pdf: result.file, fileName: result.file.name, lines };
    });
  }
  /** Totals per currency; ARS and USD are never added together. */
  totales(order: BranchOrder) {
    const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let ars = 0, usd = 0;
    for (const l of order.lines) {
      const amount = l.total ?? (l.unitPrice != null && l.expected ? l.unitPrice * l.expected : 0);
      if (l.currency === 'ARS') ars += amount || 0;
      else if (l.currency === 'USD') usd += amount || 0;
    }
    return { ars: fmt(ars), usd: fmt(usd) };
  }
  relacionar(line: OrderLine) {
    const p = this.products().find((p) => p.ean === line.ean.trim());
    if (p) { line.name = p.name; line.sku = p.sku; }
  }
  selectProduct() {
    const code = this.scanCode.trim().toUpperCase();
    const line = this.draft()?.lines.find(l => l.ean === code || l.sku?.toUpperCase() === code);
    this.selectedLine.set(line?.id ?? null);
    this.error.set(line ? '' : 'Ese EAN/SKU no pertenece al pedido.');
  }
  async captureSerial(input: HTMLInputElement) {
    const order = this.draft();
    const id = this.selectedLine();
    if (!order?.status || !id || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const saved = await this.orders.saveSerial(order.id, { orderItemId: id, serial: this.serialCode });
      this.draft.set(saved);
      this.pedidos.update(all => all.map(p => p.id === saved.id ? saved : p));
      this.serialCode = '';
      this.workspace.notify('Serial y recepción guardados en Aiven.');
    } catch (e) {
      this.error.set(this.orders.message(e));
      this.workspace.notify('No se confirmó la recepción. Conservamos el serial para reintentar.', 'error');
    } finally { this.busy.set(false); setTimeout(() => input.focus()); }
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
      const saved = await this.orders.save(d);
      this.draft.set(saved);
      this.workspace.select(d.branchId);
      this.workspace.notify('Pedido guardado en Aiven. Ya podés escanear sus productos y seriales.');
      await this.load(1, d.branchId);
    } catch (e) {
      this.error.set(this.orders.message(e));
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
