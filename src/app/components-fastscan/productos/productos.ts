import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { FastScanService, Product, SerializedUnit } from '../../services-fastscan/fastscan-service';
import { Workspace } from '../../core/workspace';
import { Icon } from '../../shared/icon';
@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [FormsModule, TableModule, DialogModule, TagModule, TooltipModule, Icon],
  templateUrl: './productos.html',
  styleUrl: './productos.css',
})
export class Productos implements OnInit {
  private data = inject(FastScanService);
  readonly workspace = inject(Workspace);
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
    this.data
      .getProductos()
      .subscribe({
        next: (p) => this.productos.set(p),
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
