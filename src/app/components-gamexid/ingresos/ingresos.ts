import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { DatePipe } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { StepperModule } from 'primeng/stepper';
import { TagModule } from 'primeng/tag';
import {
  GamexidService,
  Product,
  ProductLookup,
  InventoryMovement,
} from '../../services-gamexid/gamexid-service';
import { Workspace } from '../../core/workspace';
import { Motion } from '../../shared/motion';
import { Icon } from '../../shared/icon';
interface ScanItem {
  product: Product;
  expected: number;
  text: string;
  serials: string[];
  duplicate: boolean;
}
@Component({
  selector: 'app-ingresos',
  standalone: true,
  imports: [FormsModule, DatePipe, DialogModule, StepperModule, TagModule, Icon],
  templateUrl: './ingresos.html',
  styleUrl: './ingresos.css',
})
export class Ingresos {
  private data = inject(GamexidService);
  readonly workspace = inject(Workspace);
  readonly motion = inject(Motion);
  readonly creating = signal(false);
  readonly items = signal<ScanItem[]>([]);
  readonly movements = signal<InventoryMovement[]>([]);
  readonly saving = signal(false);
  readonly lookingUp = signal(false);
  readonly identified = signal<ProductLookup | null>(null);
  readonly confirm = signal(false);
  readonly newProduct = signal(false);
  readonly unknown = signal(false);
  readonly scanMode = signal<'ean' | 'serial'>('ean');
  readonly activeProduct = signal<number | null>(null);
  readonly error = signal('');
  readonly step = computed(() => (this.confirm() ? 3 : this.items().length ? 2 : 1));
  readonly ready = computed(
    () =>
      this.items().length > 0 &&
      this.items().every(
        (i) =>
          Number.isSafeInteger(i.expected) &&
          i.expected > 0 &&
          !i.duplicate &&
          (!i.product.requiresSerialNumber || i.serials.length === i.expected),
      ),
  );
  readonly total = computed(() => this.items().reduce((n, i) => n + i.expected, 0));
  readonly list = computed(() =>
    this.movements().filter((m) => m.destinationBranchId === this.workspace.branchId()),
  );
  ean = '';
  notes = '';
  draft = { sku: '', name: '', requiresSerialNumber: true };
  get depot() { return this.workspace.branches().find(b => b.code === 'DEP-CENTRAL') ?? this.data.getDeposito(); }
  constructor() {
    this.load();
  }
  load() {
    this.data.getMovimientos().subscribe({
      next: v => this.movements.set(v),
      error: e => this.fail(e.error?.mensaje || 'No se pudieron cargar los movimientos.'),
    });
  }
  iniciarIngreso() {
    if (!this.depot.id) { this.fail('Esperá la conexión con el depósito central.'); return; }
    this.identified.set(null);
    this.creating.set(true);
    this.items.set([]);
    this.ean = '';
    this.notes = '';
    this.error.set('');
    this.unknown.set(false);
    this.scanMode.set('ean');
    this.activeProduct.set(null);
  }
  validarEan() {
    if (this.lookingUp()) return;
    this.error.set('');
    this.unknown.set(false);
    this.identified.set(null);
    const code = this.ean.trim();
    if (!code) {
      this.fail('No se recibió una lectura del scanner. Podés escribir EAN, SKU o serial manualmente y presionar Agregar.');
      return;
    }
    if (code.length > 100 || /[\x00-\x1f\x7f]/.test(code)) {
      this.fail('Ingresá un código de hasta 100 caracteres, sin caracteres de control.');
      return;
    }
    this.lookingUp.set(true);
    this.data.buscarProductoPorCodigo(code).pipe(finalize(() => this.lookingUp.set(false))).subscribe({
      next: (result) => {
        this.identified.set(result);
        if (result.alreadyInInventory) {
          this.fail('Serial identificado: ' + result.product.name + '. Esta unidad ya está registrada; no puede ingresarse de nuevo.');
          return;
        }
        const existing = this.items().find(i => i.product.id === result.product.id);
        if (existing) {
          this.activeProduct.set(existing.product.id);
          this.scanMode.set(existing.product.requiresSerialNumber ? 'serial' : 'ean');
          document.getElementById('serial-' + existing.product.id)?.focus();
          this.workspace.notify('Producto identificado. Completá los seriales o ajustá la cantidad.', 'info');
          return;
        }
        this.add(result.product);
      },
      error: (e) => {
        this.unknown.set(e.status === 404 && /^(?:\d{8}|\d{12,14})$/.test(code));
        this.fail(e.error?.mensaje || 'No se pudo consultar el catálogo. Revisá la conexión con la API.');
      },
    });
  }
  add(p: Product) {
    this.items.update((items) => [
      ...items,
      { product: p, expected: 1, text: '', serials: [], duplicate: false },
    ]);
    this.ean = '';
    this.unknown.set(false);
    this.error.set('');
    this.activeProduct.set(p.id);
    this.scanMode.set(p.requiresSerialNumber ? 'serial' : 'ean');
    setTimeout(() =>
      document
        .getElementById(p.requiresSerialNumber ? 'serial-' + p.id : 'ean-scanner-input')
        ?.focus(),
    );
  }
  edit(item: ScanItem, text: string) {
    const serials = text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    this.items.update((items) =>
      items.map((i) =>
        i === item
          ? {
              ...i,
              text,
              serials,
              duplicate: new Set(serials.map((s) => s.toUpperCase())).size !== serials.length,
            }
          : i,
      ),
    );
  }
  quantity(item: ScanItem, n: number) {
    this.items.update((items) => items.map((i) => (i === item ? { ...i, expected: n } : i)));
  }
  capture(item: ScanItem) {
    if (!item.duplicate && item.serials.length) {
      this.motion.accepted(document.getElementById('captures-' + item.product.id));
    }
  }
  remove(item: ScanItem) {
    this.items.update((v) => v.filter((i) => i !== item));
    if (this.activeProduct() === item.product.id) {
      this.activeProduct.set(null);
      this.scanMode.set('ean');
    }
  }
  nextEan() {
    this.scanMode.set('ean');
    this.activeProduct.set(null);
    setTimeout(() => document.getElementById('ean-scanner-input')?.focus());
  }
  createProduct() {
    this.data
      .crearProducto({
        sku: this.draft.sku.trim() || 'AUTO-' + this.ean.trim(),
        name: this.draft.name,
        ean: this.ean,
        requiresSerialNumber: this.draft.requiresSerialNumber,
      })
      .subscribe({
        next: (p) => {
          this.newProduct.set(false);
          this.add(p);
        },
        error: (e) => this.fail(e.error?.mensaje || 'No se pudo crear el producto.'),
      });
  }
  save() {
    if (!this.ready() || this.saving() || !this.depot.id) return;
    this.saving.set(true);
    this.data
      .registrarIngreso({
        destinationBranchId: this.depot.id,
        notes: this.notes,
        items: this.items().map((i) => ({
          productId: i.product.id,
          quantity: i.expected,
          serials: i.serials,
          requiresSerialNumber: i.product.requiresSerialNumber,
        })),
      })
      .subscribe({
        next: (m) => {
          this.saving.set(false);
          this.confirm.set(false);
          this.creating.set(false);
          this.workspace.select(this.depot.id);
          this.load();
          this.workspace.notify('Ingreso #' + m.id + ' registrado correctamente.');
        },
        error: (e) => {
          this.saving.set(false);
          this.confirm.set(false);
          this.fail(e.error?.mensaje || 'No se pudo registrar el ingreso.');
        },
      });
  }
  fail(text: string) {
    this.error.set(text);
    this.workspace.notify(text, 'error');
  }
  branch(id?: number) {
    return this.workspace.branches().find((b) => b.id === id)?.name || 'Sucursal';
  }
  count(m: InventoryMovement) {
    return m.items.reduce((n, i) => n + i.quantity, 0);
  }
}
