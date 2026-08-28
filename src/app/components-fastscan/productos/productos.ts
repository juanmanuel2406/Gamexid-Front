import { Component, OnInit } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { gsap } from 'gsap';

import {
  FastScanService,
  Product,
  SerializedUnit,
} from '../../services-fastscan/fastscan-service';

@Component({
  selector: 'app-productos',
  templateUrl: './productos.html',
  styleUrl: './productos.css',
  standalone: false,
})
export class Productos implements OnInit {
  productos: Product[] = [];
  filtro = '';
  mensaje = '';
  tipoMensaje: 'ok' | 'error' = 'ok';

  // alta
  mostrarAlta = false;
  nuevoSku = '';
  nuevoNombre = '';
  nuevoEan = '';
  nuevoSerial = false;
  guardando = false;

  // detalle seriales
  detalleProducto: Product | null = null;
  detalleUnidades: SerializedUnit[] = [];

  constructor(private service: FastScanService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.service.getProductos().subscribe((r) => {
      this.productos = r;
      this.cdr.detectChanges();
      setTimeout(() => {
        gsap.from('.prod-row', { opacity: 0, y: 10, duration: 0.4, stagger: 0.04, ease: 'power2.out' });
      }, 50);
    });
  }

  get productosFiltrados(): Product[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) return this.productos;
    return this.productos.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.ean.includes(q)
    );
  }

  notificar(mensaje: string, tipo: 'ok' | 'error'): void {
    this.mensaje = mensaje;
    this.tipoMensaje = tipo;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.mensaje = '';
      this.cdr.detectChanges();
    }, 3500);
  }

  abrirAlta(): void {
    this.mostrarAlta = true;
    this.nuevoSku = '';
    this.nuevoNombre = '';
    this.nuevoEan = '';
    this.nuevoSerial = false;
  }

  cerrarAlta(): void {
    this.mostrarAlta = false;
  }

  guardarProducto(): void {
    if (!this.nuevoSku.trim() || !this.nuevoNombre.trim() || !this.nuevoEan.trim()) {
      this.notificar('Completá SKU, nombre y EAN.', 'error');
      return;
    }
    this.guardando = true;
    this.service
      .crearProducto({
        sku: this.nuevoSku.trim(),
        name: this.nuevoNombre.trim(),
        ean: this.nuevoEan.trim(),
        requiresSerialNumber: this.nuevoSerial,
      })
      .subscribe({
        next: () => {
          this.guardando = false;
          this.cerrarAlta();
          this.notificar('Producto creado correctamente.', 'ok');
          this.cargar();
        },
        error: (err: any) => {
          this.guardando = false;
          this.notificar(err.error?.mensaje || 'No se pudo crear el producto.', 'error');
          this.cdr.detectChanges();
        },
      });
  }

  verSeriales(p: Product): void {
    this.detalleProducto = p;
    this.service.getUnidadesDeProducto(p.id).subscribe((u) => {
      this.detalleUnidades = u;
      this.cdr.detectChanges();
    });
  }

  cerrarDetalle(): void {
    this.detalleProducto = null;
  }

  serialLabel(s: SerializedUnit): string {
    switch (s.status) {
      case 'Available':
        return 'Disponible';
      case 'Sold':
        return 'Vendida';
      case 'Transferred':
        return 'Transferida';
      default:
        return 'Devuelta';
    }
  }
}
