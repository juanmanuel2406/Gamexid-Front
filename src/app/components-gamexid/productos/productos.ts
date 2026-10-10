import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { GamexidService, Product, SerializedUnit } from '../../services-gamexid/gamexid-service';
import { Workspace } from '../../core/workspace';
import { Icon } from '../../shared/icon';
import { InventoryStore } from '../../core/inventory-store';
import { enterStagger, growBars } from '../../shared/anim';
@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [FormsModule, TableModule, DialogModule, TagModule, TooltipModule, Icon],
  templateUrl: './productos.html',
  styleUrl: './productos.css',
})
export class Productos implements OnInit {
  private data = inject(GamexidService);
  readonly workspace = inject(Workspace);
  private store = inject(InventoryStore);
  /** Available units per product, from the shared inventory store. */
  readonly stock = computed(() => {
    const map = new Map<number, number>();
    for (const u of this.store.available()) map.set(u.productId, (map.get(u.productId) || 0) + 1);
    return map;
  });
  readonly maxStock = computed(() => Math.max(1, ...this.stock().values()));
  private entered = false;
  readonly productos = signal<Product[]>([]);
  readonly filtro = signal('');
  readonly mostrarAlta = signal(false);
  readonly saving = signal(false);
  readonly detalle = signal<Product | null>(null);
  readonly units = signal<SerializedUnit[]>([]);
  draft = { sku: '', name: '', ean: '', requiresSerialNumber: false };
  readonly filtered = computed(() => {
    const q = this.filtro().trim().toLowerCase();
    return this.productos().filter((p) =>
      [p.name, p.sku, p.ean].some((v) => v.toLowerCase().includes(q)),
    );
  });
  ngOnInit() {
    this.load();
  }
  load() {
    this.data.getProductos().subscribe({
      next: (p) => {
        this.productos.set(p);
        if (!this.entered) {
          this.entered = true;
          setTimeout(() => {
            enterStagger(document.querySelectorAll('.prod-row'), 0, 25);
            growBars(Array.from(document.querySelectorAll('.prod-row .gx-meter i')), 'x', 200, 25);
          });
        }
      },
      error: () => this.workspace.notify('No se pudo cargar el catálogo.', 'error'),
    });
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
    this.data.getUnidadesDeProducto(p.id).subscribe((u) => this.units.set(u));
  }
}
