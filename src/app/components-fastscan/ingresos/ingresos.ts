import { Component, OnInit } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { gsap } from 'gsap';

import {
  FastScanService,
  Branch,
  Product,
  InventoryMovement,
} from '../../services-fastscan/fastscan-service';

interface ItemIngreso {
  product: Product;
  cantidad: number;
  seriales: string[];
  simulando: boolean;
  estado: 'validado' | 'pendiente' | 'duplicado';
  serialTexto: string;
}

@Component({
  selector: 'app-ingresos',
  templateUrl: './ingresos.html',
  styleUrl: './ingresos.css',
  standalone: false,
})
export class Ingresos implements OnInit {
  sucursales: Branch[] = [];
  ingresos: InventoryMovement[] = [];

  // modo listado vs crear
  modoCrear = false;

  // formulario ingreso
  sucursalDestinoId = 0;
  notas = '';
  eanIngresado = '';
  validando = false;
  eanEstado: 'ok' | 'invalido' | 'duplicado' | null = null;
  eanMensaje = '';
  items: ItemIngreso[] = [];
  progreso = 0;

  // alta rápida de producto desconocido
  mostrarAltaProducto = false;
  altaSku = '';
  altaNombre = '';
  altaSerial = false;

  // cierre
  mostrandoResumen = false;
  guardando = false;
  mensaje = '';
  tipoMensaje: 'ok' | 'error' = 'ok';

  constructor(private service: FastScanService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.service.getSucursales().subscribe((r) => (this.sucursales = r.filter((s) => s.isActive)));
    this.service.getMovimientos().subscribe((r) => (this.ingresos = r));
    this.cdr.detectChanges();
  }

  /* ===== Entrada ===== */
  iniciarIngreso(): void {
    this.modoCrear = true;
    this.items = [];
    this.eanIngresado = ' ';
    this.eanIngresado = '';
    this.notas = '';
    this.sucursalDestinoId = this.sucursales[0]?.id || 0;
    this.progreso = 0;
    window.scrollTo(0, 0);
  }

  cancelarIngreso(): void {
    this.modoCrear = false;
    this.items = [];
  }

  /* ===== Validación EAN en vivo ===== */
  validarEan(): void {
    const ean = this.eanIngresado.trim();
    if (!ean) return;

    // duplicado en el ingreso actual
    if (this.items.some((i) => i.product.ean === ean)) {
      this.eanEstado = 'duplicado';
      this.eanMensaje = 'Este EAN ya fue cargado en el ingreso.';
      this.cdr.detectChanges();
      return;
    }

    this.validando = true;
    this.eanEstado = null;
    this.cdr.detectChanges();

    // pequeña pausa simulando consulta
    setTimeout(() => {
      this.service.buscarProductoPorEan(ean).subscribe((p) => {
        this.validando = false;
        if (!p) {
          this.eanEstado = 'invalido';
          this.eanMensaje = 'Producto no registrado. Podés crearlo al instante.';
          this.cdr.detectChanges();
          return;
        }
        this.agregarItem(p);
      });
    }, 600);
  }

  agregarItem(p: Product): void {
    this.items.push({
      product: p,
      cantidad: p.requiresSerialNumber ? 0 : 1,
      seriales: [],
      simulando: false,
      estado: 'validado',
      serialTexto: '',
    });
    this.eanIngresado = '';
    this.eanEstado = null;
    this.actualizarProgreso();
    this.cdr.detectChanges();
  }

  /* ===== Seriales ===== */
  onSerialTexto(item: ItemIngreso): void {
    // parsea seriales separados por coma o enter
    const partes = item.serialTexto
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    item.seriales = partes;
    item.cantidad = partes.length;
    this.actualizarProgreso();
    this.cdr.detectChanges();
  }

  itemSinSeriales(item: ItemIngreso): boolean {
    return item.product.requiresSerialNumber && item.seriales.length === 0;
  }

  quitarItem(index: number): void {
    this.items.splice(index, 1);
    this.actualizarProgreso();
    this.cdr.detectChanges();
  }

  /* ===== Progreso ===== */
  actualizarProgreso(): void {
    if (this.items.length === 0) {
      this.progreso = 0;
      return;
    }
    const completos = this.items.filter((i) => !this.itemSinSeriales(i)).length;
    this.progreso = Math.round((completos / this.items.length) * 100);
  }

  get puedeCerrar(): boolean {
    return this.items.length > 0 && this.progreso === 100 && this.sucursalDestinoId > 0;
  }

  /* ===== Alta rápida de producto ===== */
  abrirAltaProducto(): void {
    this.mostrarAltaProducto = true;
    this.altaSku = '';
    this.altaNombre = '';
    this.altaSerial = false;
  }

  cerrarAltaProducto(): void {
    this.mostrarAltaProducto = false;
  }

  guardarProductoRapido(): void {
    if (!this.altaNombre.trim() || !this.eanIngresado.trim()) {
      this.mensaje = 'Completá al menos el nombre y el EAN.';
      this.tipoMensaje = 'error';
      this.cdr.detectChanges();
      return;
    }
    const sku = this.altaSku.trim() || 'AUTO-' + this.eanIngresado.trim();
    this.service
      .crearProducto({
        sku,
        name: this.altaNombre.trim(),
        ean: this.eanIngresado.trim(),
        requiresSerialNumber: this.altaSerial,
      })
      .subscribe({
        next: (p) => {
          this.cerrarAltaProducto();
          this.agregarItem(p);
        },
        error: (err: any) => {
          this.mensaje = err.error?.mensaje || 'No se pudo crear el producto.';
          this.tipoMensaje = 'error';
          this.cdr.detectChanges();
        },
      });
  }

  /* ===== Cierre ===== */
  abrirResumen(): void {
    this.mostrandoResumen = true;
    window.scrollTo(0, 0);
  }

  cerrarResumen(): void {
    this.mostrandoResumen = false;
  }

  // Simula el avance de progreso/análisis al cerrar (estilo importación)
  guardarIngreso(): void {
    this.guardando = true;
    const dto = {
      destinationBranchId: this.sucursalDestinoId,
      notes: this.notas.trim() || undefined,
      items: this.items.map((i) => ({
        productId: i.product.id,
        quantity: i.cantidad,
        serials: i.seriales,
        requiresSerialNumber: i.product.requiresSerialNumber,
      })),
    };

    this.service.registrarIngreso(dto).subscribe({
      next: () => {
        setTimeout(() => {
          this.guardando = false;
          this.mostrandoResumen = false;
          this.modoCrear = false;
          this.notificar(`Ingreso #${this.ultimoId()} registrado correctamente.`, 'ok');
          this.service.getMovimientos().subscribe((r) => (this.ingresos = r));
          this.cdr.detectChanges();
        }, 1200);
      },
      error: (err: any) => {
        this.guardando = false;
        this.notificar(err.error?.mensaje || 'No se pudo registrar el ingreso.', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  private ultimoId(): number {
    return this.ingresos.reduce((m, i) => Math.max(m, i.id), 0);
  }

  notificar(m: string, t: 'ok' | 'error'): void {
    this.mensaje = m;
    this.tipoMensaje = t;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.mensaje = '';
      this.cdr.detectChanges();
    }, 4000);
  }

  /* ===== Helpers ===== */
  sucursalNombre(id: number): string {
    return this.sucursales.find((s) => s.id === id)?.name || `Sucursal #${id}`;
  }

  fechaLegible(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  totalItems(mov: InventoryMovement): number {
    return mov.items.reduce((acc, it) => acc + (it.quantity || 0), 0);
  }

  totalUnidades(): number {
    return this.items.reduce((acc, i) => acc + i.cantidad, 0);
  }
}
